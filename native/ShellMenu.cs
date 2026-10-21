using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        string target = null;
        bool dump = false;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--dump") dump = true;
            else if (args[i] == "--path" && i + 1 < args.Length) target = args[++i];
            else if (!args[i].StartsWith("--") && target == null) target = args[i];
        }
        if (string.IsNullOrEmpty(target))
        {
            Console.Error.WriteLine("missing --path");
            Environment.Exit(2);
        }
        try
        {
            Application.EnableVisualStyles();
            using (var form = new MenuForm())
            {
                form.Opacity = 0.01;
                form.Show();
                Application.DoEvents();
                IntPtr handle = form.Handle;
                ShowMenu(target, handle, dump, form);
                form.Hide();
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            Environment.Exit(1);
        }
    }

    static void ShowMenu(string path, IntPtr hwnd, bool dump, MenuForm form)
    {
        IShellFolder desktop;
        int hr = SHGetDesktopFolder(out desktop);
        if (hr != 0) throw new COMException("SHGetDesktopFolder", hr);

        uint eaten = 0;
        uint attributes = 0;
        IntPtr pidl;
        hr = desktop.ParseDisplayName(IntPtr.Zero, IntPtr.Zero, path, out eaten, out pidl, ref attributes);
        if (hr != 0) throw new COMException("ParseDisplayName", hr);

        Guid iid = typeof(IContextMenu).GUID;
        IntPtr contextPtr;
        hr = desktop.GetUIObjectOf(hwnd, 1, new IntPtr[] { pidl }, ref iid, IntPtr.Zero, out contextPtr);
        if (hr != 0) throw new COMException("GetUIObjectOf", hr);

        object contextObject = Marshal.GetObjectForIUnknown(contextPtr);
        var context = (IContextMenu)contextObject;
        form.Attach(contextObject);

        IntPtr menu = CreatePopupMenu();
        hr = context.QueryContextMenu(menu, 0, 1, 0x7FFF, 0x00000100);
        if (hr < 0) throw new COMException("QueryContextMenu", hr);

        if (dump)
        {
            DumpMenu(menu, "");
            return;
        }

        SetForegroundWindow(hwnd);
        POINT point;
        GetCursorPos(out point);
        uint command = (uint)TrackPopupMenuEx(menu, 0x0100, point.X, point.Y, hwnd, IntPtr.Zero);
        PostMessage(hwnd, 0, IntPtr.Zero, IntPtr.Zero);
        if (command > 0)
        {
            var info = new CMINVOKECOMMANDINFOEX();
            info.cbSize = Marshal.SizeOf(typeof(CMINVOKECOMMANDINFOEX));
            info.fMask = 0x00004000;
            info.hwnd = hwnd;
            info.lpVerb = (IntPtr)((int)command - 1);
            info.lpVerbW = (IntPtr)((int)command - 1);
            info.nShow = 1;
            context.InvokeCommand(ref info);
        }
    }

    static void DumpMenu(IntPtr menu, string indent)
    {
        int count = GetMenuItemCount(menu);
        if (indent.Length == 0) Console.WriteLine("COUNT=" + count);
        for (int i = 0; i < count; i++)
        {
            var info = new MENUITEMINFO();
            info.cbSize = (uint)Marshal.SizeOf(typeof(MENUITEMINFO));
            info.fMask = 0x00000040 | 0x00000004;
            info.cch = 512;
            IntPtr buffer = Marshal.AllocHGlobal(1024);
            try
            {
                info.dwTypeData = buffer;
                if (!GetMenuItemInfo(menu, (uint)i, true, ref info))
                {
                    if (indent.Length == 0) Console.WriteLine("ITEMFAIL " + i + " err=" + Marshal.GetLastWin32Error());
                    continue;
                }
                string text = Marshal.PtrToStringUni(buffer) ?? "";
                if (info.hSubMenu != IntPtr.Zero)
                {
                    Console.WriteLine(indent + "[" + text + "]");
                    DumpMenu(info.hSubMenu, indent + "  ");
                }
                else if (text.Length > 0)
                {
                    Console.WriteLine(indent + text);
                }
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct MENUITEMINFO
    {
        public uint cbSize;
        public uint fMask;
        public uint fType;
        public uint fState;
        public uint wID;
        public IntPtr hSubMenu;
        public IntPtr hbmpChecked;
        public IntPtr hbmpUnchecked;
        public IntPtr dwItemData;
        public IntPtr dwTypeData;
        public uint cch;
        public IntPtr hbmpItem;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct CMINVOKECOMMANDINFOEX
    {
        public int cbSize;
        public int fMask;
        public IntPtr hwnd;
        public IntPtr lpVerb;
        public IntPtr lpParameters;
        public IntPtr lpDirectory;
        public int nShow;
        public int dwHotKey;
        public IntPtr hIcon;
        public IntPtr lpTitle;
        public IntPtr lpVerbW;
        public IntPtr lpParametersW;
        public IntPtr lpDirectoryW;
        public IntPtr lpTitleW;
        public POINT ptInvoke;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct POINT
    {
        public int X;
        public int Y;
    }

    [ComImport, Guid("000214F2-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IEnumIDList
    {
        int Next(uint celt, out IntPtr rgelt, out uint pceltFetched);
        int Skip(uint celt);
        int Reset();
        int Clone(out IEnumIDList ppenum);
    }

    [ComImport, Guid("000214E6-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellFolder
    {
        [PreserveSig] int ParseDisplayName(IntPtr hwnd, IntPtr pbc, [MarshalAs(UnmanagedType.LPWStr)] string pszDisplayName, out uint pchEaten, out IntPtr ppidl, ref uint pdwAttributes);
        [PreserveSig] int EnumObjects(IntPtr hwnd, uint grfFlags, out IEnumIDList ppenumIDList);
        [PreserveSig] int BindToObject(IntPtr pidl, IntPtr pbc, ref Guid riid, out IntPtr ppv);
        [PreserveSig] int BindToStorage(IntPtr pidl, IntPtr pbc, ref Guid riid, out IntPtr ppv);
        [PreserveSig] int CompareIDs(IntPtr lParam, IntPtr pidl1, IntPtr pidl2);
        [PreserveSig] int CreateViewObject(IntPtr hwndOwner, ref Guid riid, out IntPtr ppv);
        [PreserveSig] int GetAttributesOf(uint cidl, IntPtr[] apidl, ref uint rgfInOut);
        [PreserveSig] int GetUIObjectOf(IntPtr hwndOwner, uint cidl, [In, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 1)] IntPtr[] apidl, ref Guid riid, IntPtr rgfReserved, out IntPtr ppv);
        [PreserveSig] int GetDisplayNameOf(IntPtr pidl, uint uFlags, IntPtr pName);
        [PreserveSig] int SetNameOf(IntPtr hwnd, IntPtr pidl, [MarshalAs(UnmanagedType.LPWStr)] string pszName, uint uFlags, out IntPtr ppidlOut);
    }

    [ComImport, Guid("000214E4-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IContextMenu
    {
        [PreserveSig] int QueryContextMenu(IntPtr hmenu, uint indexMenu, int idCmdFirst, int idCmdLast, uint uFlags);
        [PreserveSig] int InvokeCommand(ref CMINVOKECOMMANDINFOEX pici);
        [PreserveSig] int GetCommandString(IntPtr idCmd, uint uFlags, IntPtr reserved, StringBuilder commandString, uint cch);
    }

    [ComImport, Guid("000214F4-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IContextMenu2
    {
        [PreserveSig] int QueryContextMenu(IntPtr hmenu, uint indexMenu, int idCmdFirst, int idCmdLast, uint uFlags);
        [PreserveSig] int InvokeCommand(ref CMINVOKECOMMANDINFOEX pici);
        [PreserveSig] int GetCommandString(IntPtr idCmd, uint uFlags, IntPtr reserved, StringBuilder commandString, uint cch);
        [PreserveSig] int HandleMenuMsg(uint uMsg, IntPtr wParam, IntPtr lParam);
    }

    [ComImport, Guid("000214F5-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IContextMenu3
    {
        [PreserveSig] int QueryContextMenu(IntPtr hmenu, uint indexMenu, int idCmdFirst, int idCmdLast, uint uFlags);
        [PreserveSig] int InvokeCommand(ref CMINVOKECOMMANDINFOEX pici);
        [PreserveSig] int GetCommandString(IntPtr idCmd, uint uFlags, IntPtr reserved, StringBuilder commandString, uint cch);
        [PreserveSig] int HandleMenuMsg(uint uMsg, IntPtr wParam, IntPtr lParam);
        [PreserveSig] int HandleMenuMsg2(uint uMsg, IntPtr wParam, IntPtr lParam, out IntPtr plResult);
    }

    class MenuForm : Form
    {
        private IContextMenu2 menu2;
        private IContextMenu3 menu3;

        public MenuForm()
        {
            ShowInTaskbar = false;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            Bounds = new Rectangle(-4000, -4000, 1, 1);
        }

        public void Attach(object contextObject)
        {
            menu3 = contextObject as IContextMenu3;
            menu2 = contextObject as IContextMenu2;
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == 0x0117 || message.Msg == 0x002B || message.Msg == 0x002C)
            {
                if (menu3 != null)
                {
                    IntPtr result;
                    menu3.HandleMenuMsg2((uint)message.Msg, message.WParam, message.LParam, out result);
                }
                else if (menu2 != null)
                {
                    menu2.HandleMenuMsg((uint)message.Msg, message.WParam, message.LParam);
                }
            }
            base.WndProc(ref message);
        }
    }

    [DllImport("shell32.dll")]
    static extern int SHGetDesktopFolder(out IShellFolder ppshf);

    [DllImport("user32.dll")]
    static extern IntPtr CreatePopupMenu();

    [DllImport("user32.dll")]
    static extern int TrackPopupMenuEx(IntPtr hmenu, uint flags, int x, int y, IntPtr hwnd, IntPtr lptpm);

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool GetCursorPos(out POINT point);

    [DllImport("user32.dll")]
    static extern int GetMenuItemCount(IntPtr hMenu);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool GetMenuItemInfo(IntPtr hMenu, uint item, bool byPosition, ref MENUITEMINFO itemInfo);
}
