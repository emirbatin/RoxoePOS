!macro customInstall
  ; Kurulum başladığında gösterilecek Windows bildirimlerini devre dışı bırak
  SetSilent silent
  
  ; Güncelleme sırasında hata ayıklama çıktısı (isteğe bağlı)
  ; DetailPrint "Güncelleme işlemi başlatılıyor..."
!macroend

!macro customUnInstall
  ; Kaldırma işlemi için de sessiz mod
  SetSilent silent
!macroend