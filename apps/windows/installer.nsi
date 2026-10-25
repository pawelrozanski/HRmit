; HRmit for Windows (ADR 0008). Built by build.js: makensis /DVERSION=x.y.z installer.nsi
; Per user, no administrator rights. Program in %LOCALAPPDATA%\Programs\HRmit, data in
; %APPDATA%\HRmit (written by the server, never touched here, so it survives updates and
; uninstalls).
Unicode true
!include "MUI2.nsh"

Name "HRmit"
OutFile "release\HRmit-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\HRmit"
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\HRmit"
!define MUI_ICON "hrmit.ico"
!define MUI_UNICON "hrmit.ico"
; "Run HRmit" on the last page goes through the shortcut, so it starts minimized like a click.
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION RunHRmit
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Polish"

!macro Shortcut path
  ; Minimized: the launcher's console only blinks in the taskbar for a second.
  CreateShortCut "${path}" "$INSTDIR\HRmit.exe" '"$INSTDIR\launcher.mjs"' "$INSTDIR\hrmit.ico" 0 SW_SHOWMINIMIZED
!macroend

Section
  ; A running HRmit holds its files open. Its image name is HRmit.exe (the bundled node.exe,
  ; renamed), so this stops only HRmit; SQLite in WAL mode survives a hard stop.
  nsExec::Exec 'taskkill /F /IM HRmit.exe'
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "dist\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  !insertmacro Shortcut "$DESKTOP\HRmit.lnk"
  !insertmacro Shortcut "$SMPROGRAMS\HRmit.lnk"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "HRmit"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "HRmit (open source, MIT)"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\hrmit.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM HRmit.exe'
  Delete "$DESKTOP\HRmit.lnk"
  Delete "$SMPROGRAMS\HRmit.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd

Function RunHRmit
  ExecShell "" "$SMPROGRAMS\HRmit.lnk"
FunctionEnd
