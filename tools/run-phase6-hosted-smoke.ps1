[CmdletBinding()]
param(
  [switch]$ConfigOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$expectedPreviewUrl = "https://fulfillment-management-platform-b9d85avh4.vercel.app"
$previewUrl = $env:PHASE6_PREVIEW_URL
if ([string]::IsNullOrWhiteSpace($previewUrl)) {
  throw "PHASE6_PREVIEW_URL is required."
}

try {
  $parsedPreviewUrl = [Uri]$previewUrl
} catch {
  throw "PHASE6_PREVIEW_URL is not a valid URL."
}

if ($parsedPreviewUrl.AbsoluteUri.TrimEnd("/") -ne $expectedPreviewUrl) {
  throw "PHASE6_PREVIEW_URL must be the approved non-production Preview deployment."
}

if ([string]::IsNullOrWhiteSpace($env:VERCEL_AUTOMATION_BYPASS_SECRET)) {
  throw "VERCEL_AUTOMATION_BYPASS_SECRET is required."
}

$runner = Join-Path $PSScriptRoot "..\tests\phase6\hosted-auth-smoke.mjs"
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
  throw "The Phase 6 hosted smoke runner is missing."
}

if ($ConfigOnly) {
  & node $runner --config-check
  exit $LASTEXITCODE
}

$credentialTargetVariables = [ordered]@{
  "client-b" = "PHASE6_CLIENT_B_CREDENTIAL_TARGET"
  "client-a" = "PHASE6_CLIENT_A_CREDENTIAL_TARGET"
  "salesperson-a" = "PHASE6_SALESPERSON_A_CREDENTIAL_TARGET"
  "salesperson-b" = "PHASE6_SALESPERSON_B_CREDENTIAL_TARGET"
  "fulfillment-operator" = "PHASE6_FULFILLMENT_OPERATOR_CREDENTIAL_TARGET"
  "super-admin" = "PHASE6_SUPER_ADMIN_CREDENTIAL_TARGET"
}

if (-not ([System.Management.Automation.PSTypeName]"Phase6CredentialReader").Type) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public sealed class Phase6CredentialValue {
  public string Username { get; set; }
  public string Password { get; set; }
}

public static class Phase6CredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct NativeCredential {
    public uint Flags;
    public uint Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }

  [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern void CredFree(IntPtr credential);

  public static Phase6CredentialValue Read(string target) {
    if (String.IsNullOrWhiteSpace(target)) throw new ArgumentException("Credential target is required.");
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) throw new InvalidOperationException("Credential target is unavailable.");
    try {
      var native = (NativeCredential)Marshal.PtrToStructure(pointer, typeof(NativeCredential));
      var username = native.UserName == IntPtr.Zero ? "" : Marshal.PtrToStringUni(native.UserName) ?? "";
      var bytes = new byte[native.CredentialBlobSize];
      if (native.CredentialBlob != IntPtr.Zero && bytes.Length > 0) Marshal.Copy(native.CredentialBlob, bytes, 0, bytes.Length);
      var password = Encoding.Unicode.GetString(bytes).TrimEnd('\0');
      return new Phase6CredentialValue { Username = username, Password = password };
    } finally {
      CredFree(pointer);
    }
  }
}
"@
}

$payload = foreach ($role in $credentialTargetVariables.GetEnumerator()) {
  $target = [Environment]::GetEnvironmentVariable($role.Value)
  if ([string]::IsNullOrWhiteSpace($target)) {
    throw "Missing non-secret Credential Manager target mapping for role $($role.Key)."
  }
  try {
    $credential = [Phase6CredentialReader]::Read($target)
  } catch {
    throw "Credential Manager entry unavailable for role $($role.Key)."
  }
  if ([string]::IsNullOrWhiteSpace($credential.Username) -or [string]::IsNullOrWhiteSpace($credential.Password)) {
    throw "Credential Manager entry is incomplete for role $($role.Key)."
  }
  [ordered]@{
    role = $role.Key
    email = $credential.Username
    password = $credential.Password
  }
}

$json = $payload | ConvertTo-Json -Compress -Depth 4
$json | & node $runner
$exitCode = $LASTEXITCODE
exit $exitCode
