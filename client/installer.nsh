!macro customHeader
  !define INSTALL_MODE_NORMAL
!macroend

!macro customInstall
  ; Sadece ilk kurulum için sihirbaz göster, güncelleme için değil
  ${IfNot} ${FileExists} "$INSTDIR\resources\app-update.yml"
    ; İlk kurulum - normal modda devam et
    DetailPrint "İlk kurulum algılandı, sihirbaz gösteriliyor..."
  ${Else}
    ; Güncelleme - sessiz mod
    DetailPrint "Güncelleme algılandı, sessiz kurulum yapılıyor..."
    SetSilent silent
  ${EndIf}
!macroend

!macro customUnInstall
  ; Kaldırma işlemi her zaman sorulsun
  SetSilent false
!macroend