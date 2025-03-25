!macro customHeader
  !include LogicLib.nsh
  !include FileFunc.nsh
  !define INSTALL_QUIET_PARAM "/S"
!macroend

!macro customInit
  ${GetParameters} $R0
  ${IfNot} ${FileExists} "$INSTDIR\resources\app-update.yml"
    ; İlk kurulum - normal mod
    DetailPrint "İlk kurulum tespit edildi"
  ${Else}
    ; Güncelleme - sessiz mod
    DetailPrint "Güncelleme tespit edildi, sessiz modda kurulum yapılıyor"
    IfSilent +1 0
    SetSilent silent
  ${EndIf}
!macroend

!macro customInstall
  ; Burada özel kurulum komutları olabilir
!macroend

!macro customUnInstall
  ; Kaldırma sihirbazı her zaman görünür olsun
  IfSilent 0 +1
  SetSilent normal
!macroend