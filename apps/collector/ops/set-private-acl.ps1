# Run as the dedicated collector user. Only explicitly supplied paths are changed.
[CmdletBinding(SupportsShouldProcess = $true)]
param([Parameter(Mandatory = $true)][string[]]$Path)
$ErrorActionPreference = 'Stop'
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach ($itemPath in $Path) {
    $item = Get-Item -LiteralPath $itemPath -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        throw 'Reparse points are not allowed.'
    }
    $acl = if ($item.PSIsContainer) {
        New-Object System.Security.AccessControl.DirectorySecurity
    } else {
        New-Object System.Security.AccessControl.FileSecurity
    }
    $acl.SetOwner($owner)
    $acl.SetAccessRuleProtection($true, $false)
    $inheritance = if ($item.PSIsContainer) {
        [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
    } else {
        [System.Security.AccessControl.InheritanceFlags]::None
    }
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
        $owner, 'FullControl', $inheritance, 'None', 'Allow')
    $acl.AddAccessRule($rule)
    if ($PSCmdlet.ShouldProcess($item.FullName, 'Set owner-only collector ACL')) {
        Set-Acl -LiteralPath $item.FullName -AclObject $acl
    }
}
