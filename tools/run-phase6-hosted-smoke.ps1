[CmdletBinding()]
param(
  [switch]$ConfigOnly,
  [switch]$PreflightOnly,
  [switch]$AuthenticationMetadataCapture,
  [string]$VercelCliPath = (Join-Path $env:LOCALAPPDATA 'npm-cache\_npx\80bcb0c7f142fce6\node_modules\vercel\dist\vc.js')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Bounded P7 Salesperson A closure, not the historical six-account suite.
# Target identity comes exclusively from the reconciled evidence and runner pins.
# No environment URL, bypass secret, environment pull, token file, or browser trace.
$runner = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\tests\phase6\hosted-auth-smoke.mjs'))
$nodePath = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$expectedTarget = 'FMP-P6S-STAGING-SALES_A'
$expectedUsername = 'p6s-20260902040001-b313d7f9.sales-a@synthetic.invalid'

function Get-ProtectedSalespersonCredential {
  if (-not ([System.Management.Automation.PSTypeName]'Phase7BoundedCredentialReader').Type) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public sealed class Phase7BoundedCredentialValue {
  public string Username { get; set; }
  public string Password { get; set; }
}
public static class Phase7BoundedCredentialReader {
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
  [DllImport("advapi32.dll")]
  private static extern void CredFree(IntPtr credential);
  public static Phase7BoundedCredentialValue ReadSalespersonA() {
    IntPtr pointer;
    if (!CredRead("FMP-P6S-STAGING-SALES_A", 1, 0, out pointer))
      throw new InvalidOperationException("Protected entry unavailable.");
    byte[] bytes = null;
    try {
      var native = (NativeCredential)Marshal.PtrToStructure(pointer, typeof(NativeCredential));
      var username = native.UserName == IntPtr.Zero ? "" : Marshal.PtrToStringUni(native.UserName) ?? "";
      if (username != "p6s-20260902040001-b313d7f9.sales-a@synthetic.invalid")
        throw new InvalidOperationException("Protected username mismatch.");
      if (native.CredentialBlobSize == 0 || native.CredentialBlobSize % 2 != 0)
        throw new InvalidOperationException("Protected entry invalid.");
      bytes = new byte[native.CredentialBlobSize];
      Marshal.Copy(native.CredentialBlob, bytes, 0, bytes.Length);
      return new Phase7BoundedCredentialValue { Username = username, Password = Encoding.Unicode.GetString(bytes).TrimEnd('\0') };
    } finally {
      if (bytes != null) Array.Clear(bytes, 0, bytes.Length);
      CredFree(pointer);
    }
  }
}
'@
  }
  return [Phase7BoundedCredentialReader]::ReadSalespersonA()
}

$child = $null
$childStarted = $false
$launcherStage = 'LOCAL_PREFLIGHT'
$credential = $null
$privatePayload = $null
$exitCode = 1
try {
  if ($ConfigOnly -and $PreflightOnly) { throw 'Conflicting modes.' }
  if ($AuthenticationMetadataCapture -and ($ConfigOnly -or $PreflightOnly)) { throw 'Conflicting capture mode.' }
  if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw 'Runner unavailable.' }
  $arguments = '"' + $runner + '"'
  if ($ConfigOnly) { $arguments += ' --config-check' }
  else {
    $resolvedCli = (Resolve-Path -LiteralPath $VercelCliPath -ErrorAction Stop).Path
    if ($resolvedCli.Contains('"')) { throw 'Invalid CLI path.' }
    $arguments += ' --vercel-cli "' + $resolvedCli + '"'
    if ($PreflightOnly) { $arguments += ' --preflight-only' }
    else { $arguments += ' --credential-pipe' }
    if ($AuthenticationMetadataCapture) { $arguments += ' --authentication-metadata-capture' }
  }
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $nodePath
  $start.Arguments = $arguments
  $start.WorkingDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  # Child-only allowlist; does not modify the operator's environment or credentials.
  $safeEnvironmentNames = @('SystemRoot','windir','COMSPEC','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','HOMEDRIVE','HOMEPATH','ProgramFiles','ProgramFiles(x86)')
  $start.EnvironmentVariables.Clear()
  foreach ($name in $safeEnvironmentNames) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($null -ne $value) { $start.EnvironmentVariables[$name] = $value }
  }
  $child = New-Object System.Diagnostics.Process
  $child.StartInfo = $start
  $launcherStage = 'START_PROCESS'
  $childStarted = $child.Start()
  $launcherStage = 'PRIVATE_IPC'
  $stderrRead = $child.StandardError.ReadToEndAsync() # private, never echoed
  $credentialSent = $false
  while ($null -ne ($line = $child.StandardOutput.ReadLine())) {
    if ($line -eq 'P7_CREDENTIAL_REQUEST') {
      if ($ConfigOnly -or $PreflightOnly -or $credentialSent) { throw 'Unexpected credential request.' }
      # Runner emits this only after live target/OIDC/protection/login-field checks.
      $launcherStage = 'CREDENTIAL_READ'
      $credential = Get-ProtectedSalespersonCredential
      if (-not [string]::Equals($credential.Username, $expectedUsername, [StringComparison]::Ordinal) -or [string]::IsNullOrEmpty($credential.Password)) { throw 'Protected identity invalid.' }
      $privatePayload = @{ target = $expectedTarget; email = $credential.Username; password = $credential.Password } | ConvertTo-Json -Compress
      $child.StandardInput.WriteLine($privatePayload)
      $child.StandardInput.Flush()
      $child.StandardInput.Close()
      $credentialSent = $true
      $credential.Password = ''
      $credential = $null
      $privatePayload = $null
      $launcherStage = 'PRIVATE_IPC'
    } elseif ($line -match '^P7_[A-Z0-9_]+=[A-Z0-9_]+$') {
      Write-Output $line
    } elseif ($line -match '^P7_FIRST_REFUSAL_([A-Z_]+)=(.{1,512})$') {
      # Exact diagnostic channel, not arbitrary child output/JSON. Match the
      # runner's redacted vocabulary; credentials/headers/body values are absent.
      $field = $Matches[1]
      $diagnosticValue = $Matches[2]
      $knownHost = '(?:fulfillment-management-platform-j4ntvrkrz\.vercel\.app|vercel\.live|vercel\.com|nftufhffzlokryafcbku\.supabase\.co|fulfillment-management-platform\.vercel\.app)'
      $knownSegment = '(?:login|dashboard|salespeople|reports|clients|administration|suppliers|products|favicon\.ico|forgot-password|_next|static|chunks|app|_next-live|feedback|feedback\.js|auth|v1|token|api|\[REDACTED\])'
      $valid = switch -Regex ($field) {
        '^UTC$' { $diagnosticValue -match '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'; break }
        '^(?:INITIATING_ORIGIN|TARGET_ORIGIN)$' { $diagnosticValue -match ('^https?://' + $knownHost + '(?::[0-9]{1,5})?$'); break }
        '^TARGET_HOSTNAME$' { $diagnosticValue -match ('^' + $knownHost + '$'); break }
        '^(?:INITIATING_PATH|INTENDED_PATH|TARGET_PATH)$' { $diagnosticValue -match ('^/(?:' + $knownSegment + '(?:/' + $knownSegment + ')*/?)?$'); break }
        '^TARGET_PROTOCOL$' { $diagnosticValue -match '^https?:$'; break }
        '^RESOURCE_TYPE$' { $diagnosticValue -match '^(?:document|stylesheet|image|media|font|script|texttrack|xhr|fetch|eventsource|websocket|manifest|other)$'; break }
        default { $false }
      }
      if (-not $valid) { throw 'Unsafe diagnostic field refused.' }
      Write-Output $line
    } else {
      # Never forward unknown subprocess output: it might contain a private value.
      throw 'Unexpected subprocess output refused.'
    }
  }
  $child.WaitForExit()
  [void]$stderrRead.GetAwaiter().GetResult()
  $exitCode = $child.ExitCode
} catch {
  # Do not print exception records, command arguments, IPC payloads or native blobs.
  Write-Output 'P7_LAUNCHER_FAILURE=PROTECTED_RUNNER_OR_CREDENTIAL_UNAVAILABLE'
  Write-Output ('P7_LAUNCHER_FAILURE_STAGE=' + $launcherStage)
  Write-Output ('P7_LAUNCHER_FAILURE_LINE=' + $_.InvocationInfo.ScriptLineNumber)
  $exitCode = 1
} finally {
  if ($null -ne $credential) { $credential.Password = '' }
  $privatePayload = $null
  if ($null -ne $child) {
    if ($childStarted -and -not $child.HasExited) { $child.StandardInput.Close(); if (-not $child.WaitForExit(30000)) { $child.Kill() } }
    $child.Dispose()
  }
}
exit $exitCode
