// src/components/DynamicWindowTitle.tsx
import { useEffect, useState, useRef } from "react";
import eventBus from "../utils/eventBus";

// Farklı zaman dilimlerine göre mesajlar
interface TimeBasedMessage {
  timeStart: number; // 0-23 saat aralığı (başlangıç)
  timeEnd: number; // 0-23 saat aralığı (bitiş)
  messages: string[]; // Görüntülenecek mesajlar
}

// Rastgele mesaj seçmek için yardımcı fonksiyon
const getRandomMessage = (messages: string[]): string => {
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};

// Kasa kapanış verisi için arayüz
interface CashRegisterCloseData {
    totalSales: number;
    cashSales: number;
    cardSales: number;
    countingDifference: number;
    theoreticalBalance: number;
    isHighSales: boolean; // Yüksek satış mı?
    isLossMaking?: boolean; // Zarar durumu
  }

interface CashRegisterOpenData {
  openingBalance: number;
  sessionId: string;
}

const DynamicWindowTitle: React.FC = () => {
  const appName = "Roxoe";
  // Başlık değişikliklerini takip eden ref
  const lastTitle = useRef<string>(appName);
  // Zamanlayıcı için ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Kasa kapanışı için özel mesaj süresi (20 dakika)
  const specialMessageDuration = 20 * 60 * 1000;
  // Özel mesaj gösteriliyor mu?
  const [showingSpecialMessage, setShowingSpecialMessage] = useState(false);
  // En son özel mesaj zamanı
  const specialMessageTimeRef = useRef<number>(0);

  // Zaman dilimine göre mesajları tanımla
  const timeBasedMessages: TimeBasedMessage[] = [
    {
      timeStart: 5,
      timeEnd: 8,
      messages: [
        "🌅 Günaydın Patron! Bugün yine kazanacağız!",
        "☕ Kahven hazır mı? Rakamlar da hazır!",
        "💪 Erken kalkan patron, cüzdanı doldurur!",
        "🌞 Güneş doğdu, kasalar açıldı!",
        "🚀 Yeni bir gün, yeni bir rekor!",
        "💼 Bugün ne satacağız? Her şeyi!",
        "🤑 Erken başlayan kazanır, sen de erkensin Patron!",
        "🌄 Gün başlıyor, kasalar şimdiden dolmaya başladı!",
      ],
    },
    {
      timeStart: 8,
      timeEnd: 11,
      messages: [
        "📊 Sabah satışları başladı, hadi bakalım!",
        "💯 İyi bir başlangıç, mükemmel bir gün demektir!",
        "🔥 Bugünkü hedefe şimdiden yaklaşıyoruz!",
        "📈 Bugün grafikler yukarı doğru!",
        "🎯 Hedefin var, planın var, başarı garanti!",
        "💼 Patron işinin başında, işler yolunda!",
        "💪 Çalış, gülümse, kazan - motto bu!",
      ],
    },
    {
      timeStart: 11,
      timeEnd: 14,
      messages: [
        "🍕 Öğle yemeği molası? Kasalar doluyor!",
        "🥪 Yemek ye, enerji topla, satışlar seni bekliyor!",
        "⚡ Öğlen enerji zamanı, satışlar da enerjik!",
        "🤝 Müşteriler akın akın! İşler tıkırında!",
        "💰 Öğlen daha yarısı, ciro çoktan yarılandı!",
        "🍽️ Yemek molası versek de, satışlar durmuyor!",
        "🥇 Bugün rekorları altüst ediyoruz!",
        "📱 Sen molada olsan da, POS hiç durmaz!",
      ],
    },
    {
      timeStart: 14,
      timeEnd: 17,
      messages: [
        "☕ Ara molası zamanı? İçtiğin kahve kadar satış yaptın!",
        "💸 Satışlar nasıl gidiyor? Harika görünüyor!",
        "📦 Stoklar tükeniyor mu? İşte bu iyi haber!",
        "🚀 Günün ikinci yarısında tempo artıyor!",
        "🔋 Hala enerjik misin? İşler yolunda gittiğine göre kesinlikle!",
        "🎮 İşi oyuna çeviren patron efsanesi!",
        "👑 Tahtındaki patron, işleri kontrol ediyor!",
        "📊 Bugünkü raporlar gelecek ve çok etkileyici olacaklar!",
      ],
    },
    {
      timeStart: 17,
      timeEnd: 21,
      messages: [
        "🌆 İyi akşamlar! Mesai biter, kazanç devam eder!",
        "🏁 Günü bağlamaya hazır mısın? Muhteşem görünüyor!",
        "🧮 Son hesaplar, en tatlı hesaplardır!",
        "🎁 Günün yorgunluğu, yarının motivasyonu!",
        "💼 Son satışlar kapıda, hesaplar masada!",
        "🚶 Eve gitmeden son bir satış daha, hadi!",
        "👔 Kravat gevşedi, ama kasalar doldu!",
        "🌟 Gün biterken, yıldızın parlamaya devam ediyor!",
      ],
    },
    {
      timeStart: 21,
      timeEnd: 24,
      messages: [
        "🌙 Geç saatlere kadar çalışıyoruz! Üretken patron, başarılı işletme!",
        "💭 Günün yorgunluğu, başarının tatlı bedeli!",
        "🎯 Hedeflerine ulaştın mı? Kesinlikle!",
        "🏆 Bugün de kazandın, yarın da kazanacaksın!",
        "🧠 Yorgun olabilirsin, ama karan hep doğru!",
        "🌠 Geç gelen satış, yıldız gibi parlar!",
        "🧮 Geç saatlerde hesaplar, sabah kahvesinden tatlıdır!",
        "💤 Uykudan önce son bir satış daha, rüyan güzel olsun!",
      ],
    },
    {
      timeStart: 0,
      timeEnd: 5,
      messages: [
        "🦉 Gece kuşları için açığız! Sen uyuma, para uyusun!",
        "🌃 Gece vardiyası, para vardiyası!",
        "💫 Gece satışları, yıldızlar gibi parlar!",
        "🔥 Ateş gibi çalışıyorsun, bravo patron!",
        "🌌 Gece çalışan, gündüz kazanır - ama sen her zaman kazanırsın!",
        "🚨 Uyku? O da ne? İş varken uyunmaz!",
        "🧩 Gece mesaisi, bilmeceyi çözen son parça!",
        "🧠 Beynin bile uyurken, senin kasalar çalışıyor!",
      ],
    },
  ];

  // Genel motivasyon mesajları - günün herhangi bir saatinde kullanılabilir
  const motivationalMessages = [
    "🚀 Sen bir girişimci efsanesisin, unutma!",
    "💪 Zorluklar seni durduramaz, sen patronsun!",
    "🏆 Her gün bir başarı hikayesi yazıyorsun!",
    "💯 İşini %100 tutkuyla yapan nadir insanlardansın!",
    "🎯 Hedefine kilitlenmiş bir patron, her zaman kazanır!",
    "🔝 Zirvedesin ve orada kalmaya devam edeceksin!",
    "💼 İş dünyasının gizli kahramanı: SEN!",
    "📈 Grafikler yükseliyor, sen de yükseliyorsun!",
    "🧠 Akıllı kararlar, büyük kazançlar getirir!",
    "⚡ Enerji dolu bir patron, işleri uçurur!",
    "🌟 Başarı senin DNA'nda var, bu yüzden parlıyorsun!",
    "🤝 Müşteriler seni seviyor, çünkü sen işini seviyorsun!",
    "🧰 İşini en iyi araçlarla yapan patron her zaman kazanır!",
    "🌈 Zorluklardan sonra her zaman parlak günler gelir!",
    "😎 Patron dediğin böyle olur işte!",
  ];

  // KASA KAPANIŞ MESAJLARI - Kasa durumuna göre özelleştirilmiş mesajlar

  // Yüksek satış mesajları
  const highSalesMessages = [
    "🔥 MUHTEŞEM GÜNÜ KAPATTIK PATRON! Rekorları parçaladın!",
    "💰 Kasalar parayla dolup taştı bugün! Tebrikler patron!",
    "💎 Bu nasıl bir satış performansı! İşte gerçek patron!",
    "🚀 Patron sen uzaya çıktın! Satışlar stratosferden selamlar!",
    "🏆 Bu günün kazananı belli: SEN! Harika performans!",
    "💵 Sayarken ellerin yorulur artık, destek lazım mı patron?",
    "🔥 Hesabın yanıyor patron! Bugün kasalar erimiş olmalı!",
    "🎯 Hedef? Ne hedefi? Sen hedefi çoktan aştın patron!",
    "🌊 Satışlar tsunami gibi geldi bugün, kasalar doldu taştı!",
    "🤑 Patron bugün cüzdanın biraz şişecek gibi, hayırlı olsun!",
  ];

  // Normal/Orta satış mesajları
  const normalSalesMessages = [
    "👍 Günü güzel kapattık patron, işler yolunda!",
    "✨ Bugün gayet iyi geçti, yarın daha da iyi olacak!",
    "💼 Başarılı bir günü daha geride bıraktık!",
    "🌟 Düzenli çalışmanın meyvelerini topluyoruz!",
    "📊 Grafikler normal seyrinde, istikrar önemli!",
    "💫 Her gün biraz daha iyiye, adım adım başarıya!",
    "🔄 İşler yolunda gidiyor, aynı tempoyla devam!",
    "💯 Bugün hedefimize ulaştık, yarın yeni hedefler!",
    "🏄‍♂️ Bugün dalgalara karşı güzel sörf yaptık patron!",
    "📋 Bugünü de başarıyla tamamladık, checklist tamam!",
  ];

  // Düşük satış mesajları (moral bozmadan)
  const lowSalesMessages = [
    "🌱 Bugün tohum ektik, yarın hasat zamanı!",
    "🔋 Sakin bir gündü, yarın için enerji depoladık!",
    "🌤️ Her gün güneşli olmaz, yarın daha parlak!",
    "🧩 Puzzle'ın her parçası önemli, bugün de bir parçayı yerine koyduk!",
    "⚡ Bazen yavaşlamak, daha hızlı ilerlemek için gereklidir!",
    "🧠 Bugün strateji günüydü, yarın uygulama zamanı!",
    "💪 Sıkma canını patron, yarın çok daha iyi olacak!",
    "🌈 Yağmurdan sonra gökkuşağı gelir, yarını bekle!",
    "📚 Bugün tecrübe günüydü, her gün bir şey öğreniyoruz!",
    "🧘‍♂️ Bugün meditasyon, yarın aksiyon zamanı patron!",
  ];

  const lossMessages = [
    '🌱 Bugün tohum attık, yarın filizlenecek! Her şey daha iyi olacak!',
    '🔄 En karanlık gece bile sabaha ulaşır patron, yarın yeni bir gün!',
    '💡 Edison bin kez başarısız oldu ama sonunda ampulü buldu. Vazgeçme!',
    '🔋 Bugün şarjımız bitti, yarın full güçle devam patron!',
    '🌈 Yağmurdan sonra gökkuşağı gelir, bekle ve gör!',
    "🎯 Bugün hedefi ıskaladık, yarın tam 12'den vuracağız!",
    '🧠 Başarısızlık, başarıya giden yolda sadece bir virajdır!',
    '⚡ Fırtınadan sonra güneş daha parlak doğar, daima!',
    '🚀 Roketler, düşmeden yükselemez! Yarına hazır mısın?',
    '💪 Zorluklarla karşılaşmamış patron, gerçek bir patron değildir!'
  ];

  // Sayım tam çıktığında mesajlar
  const perfectCountMessages = [
    "💯 Kusursuz sayım! Hesaplar şaşmıyor, patron şaşırtmıyor!",
    "🎯 Hesap, kitap tam! Sen gerçekten detaycı bir patronsun!",
    "🔍 Hesapları tıkır tıkır! Bu nasıl bir titizlik patron?",
    "🧮 Sayım şaşmaz, patron yanılmaz! Kusursuz!",
    "⚖️ Terazinin ibresi tam dengede, bravo sana!",
    "🎖️ Mükemmel sayım ödülünü kazandın! Tebrikler patron!",
  ];

  // Sayımda küçük fark olduğunda mesajlar
  const smallDifferenceMessages = [
    "👌 Sayımda ufak bir fark var, olabilir çok takma kafana!",
    "🧐 Neredeyse tam tutacaktı, yine de çok başarılı!",
    "📏 Milimetrik bir fark, ihmal edilebilir patron!",
    "⚖️ Terazi biraz oynasa da denge hala yerinde!",
    "🔎 Aradaki farkı büyüteçle aramalı, o kadar küçük!",
  ];

  // Sayımda büyük fark olduğunda mesajlar
  const largeDifferenceMessages = [
    "🤔 Hesaplarda biraz farklılık var. Yarın yeniden bakarız patron!",
    "🧩 Sayımda eksik parçalar var gibi, ama sorun değil!",
    "🌀 Bugün biraz karışık geçti anlaşılan, yarın toparlayacağız!",
    "🔄 Sayım tam tutmadı ama takma kafanı, hepimiz insanız!",
    "📝 Not aldık, bir sonraki sayıma dikkat edeceğiz patron!",
  ];

  // Haftalık ve aylık hedef mesajları - ileride gerçek verilerle değiştirilebilir
  const goalMessages = [
    "🎯 Haftalık hedefe yaklaşıyorsun, devam et!",
    "📊 Aylık hedefe %90 ulaştın, çok az kaldı!",
    "💹 Bu ayki performansın geçen ayı %15 geçti bile!",
    "🏁 Hedefe ulaşmana sadece birkaç satış kaldı!",
    "💯 Hedefi aştın, şimdi yeni zirvelere!",
    "🏅 Başardın! Bu ay tüm hedefleri aştın!",
    "📈 Satışlar rekor seviyede, tebrikler patron!",
  ];

  // Komik mesajlar - ara sıra eğlenmek için
  const funnyMessages = [
    "💰 Kasalar dolunca sevinç dansı yapmak serbest!",
    "🍕 Satışlar pizza gibi: Ne kadar olsa yetmez!",
    "🦸 Süper güçlerin yok, ama süper bir işletmen var!",
    "🧙 Satışları büyülemişsin patron, sihirli dokunuş!",
    "🎮 İşletme POS sim oyunu: Seviye atlıyorsun!",
    "🦁 Patron aslan gibi işletmeyi yönetiyor!",
    "🎭 Gülümse, satış gelecek! Kasam beni çağırıyor!",
    "🎲 Kumar oynamana gerek yok, sen zaten kazanıyorsun!",
    "🧪 İş formülünü bulmuşsun, patent aldır bence!",
    "🎨 Satış sanatının Picasso'su sensin!",
    "🌶️ Satışların acı biber gibi yakıyor ortalığı!",
  ];

  const registerOpenMessages = [
    "🌅 Güne başlamak için hazır mısın patron? Kasalar açıldı!",
    "🚀 Kasa açıldı, yeni bir rekor günü başlıyor!",
    "🔓 Kasalar açıldı, müşteriler sırada! Haydi bakalım patron!",
    "💰 Kasa açık, işletme açık, hedefler büyük! İşte bu!",
    "☕ Kasayı açtın, kahveni hazırla, bugün müthiş olacak!",
    "⚡ Kasa açıldı! Bugün elektrik gibi çalışacağız patron!",
    "📊 Kasa açık, grafikler yukarı doğru gitmeye hazır!",
    "🎯 Hedef belirle, kasayı aç, başarıyı yakala! Bugün senin günün!",
    "💼 İş başlasın! Kasa hazır, peki ya sen patron?",
    "🏁 Start verildi! Kasalar açıldı, yarış başlıyor patron!",
    "💫 Kasa açıldı, günün yıldızı sensin! Işılda patron!",
    "🌞 Yeni bir sabah, yeni bir kasa açılışı, yeni bir başarı!",
    "🌟 Kasa açık, işletme açık, yıldızın parlak! İyi satışlar patron!",
  ];

  // Özel günlere göre mesajlar
  const specialDateMessages = () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // Ocak=1, Aralık=12

    // Özel günler - daha motivasyonel versiyonları
    if (day === 1 && month === 1)
      return "🎆 Yeni Yıl, Yeni Rekorlar! Kutlu Olsun Patron!";
    if (day === 14 && month === 2)
      return "❤️ Sevgililer Günün Kutlu Olsun! İşletmen de seni seviyor!";
    if (day === 23 && month === 4)
      return "🇹🇷 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı! Geleceğin girişimcileri büyüyor!";
    if (day === 19 && month === 5)
      return "🏃 19 Mayıs Gençlik Bayramı! Enerjin hiç bitmesin!";
    if (day === 30 && month === 8)
      return "🏆 30 Ağustos Zafer Bayramı! Sen de kendi zaferlerini kazanıyorsun!";
    if (day === 29 && month === 10)
      return "🇹🇷 Cumhuriyet Bayramı Kutlu Olsun! Başarılarla dolu nice yıllar!";
    if (day === 10 && month === 11)
      return `🕊️ Atatürk'ü Saygıyla Anıyoruz! İlkelerle işinde de yüksel!`;
    if (day === 31 && month === 12)
      return "🎄 Yeni Yıla Hazır mısın? Bu yılki başarıları ikiye katlayacaksın!";

    // Ayın ilk günü
    if (day === 1)
      return "📅 Yeni bir ay, yeni fırsatlar! Bu ay rekorları kırıyoruz!";

    // Ayın son günü
    const lastDay = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();
    if (day === lastDay)
      return "🏁 Ayın son günü! Hedefleri tamamladın mı? Tebrikler patron!";

    // Normal günlere dönüş
    return null;
  };

  // Haftanın günlerine göre mesajlar - daha eğlenceli versiyonlar
  const dayOfWeekMessages = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Pazar, 1=Pazartesi, ...

    switch (dayOfWeek) {
      case 1:
        return "🚀 Pazartesi sendromu? Öyle bir şey yok! İşler tam gaz ilerliyor!";
      case 2:
        return "💼 Salı günü, stratejik kararların günü! Sen en iyisini bilirsin!";
      case 3:
        return "⚡ Çarşamba, haftanın enerji günü! Kasalar doluyor!";
      case 4:
        return "💪 Perşembe geldi, hafta sonuna yaklaştık! Tempo düşmüyor!";
      case 5:
        return "🎉 Haftanın finali! Cuma günü satışları uçuruyor!";
      case 6:
        return "💰 Cumartesi! En yoğun gün, en kazançlı gün!";
      case 0:
        return "🏆 Pazar günü de açığız! Dinlenme yok, kazanç var!";
      default:
        return null;
    }
  };

  // KASA KAPANIŞ VERİLERİNE GÖRE MESAJ SEÇİMİ
const getCashRegisterCloseMessage = (data: CashRegisterCloseData): string => {
    // EKSTRA KONTROL: Zarar durumu varsa doğrudan zarar mesajları göster
    if (data.isLossMaking) {
      return getRandomMessage(lossMessages);
    }
    
    // İlk olarak, sayım farkı kontrolü yapalım
    const differencePercent = Math.abs(data.countingDifference) / data.theoreticalBalance * 100;
    
    // Sayım tam mı kontrol et (fark ±5₺'den az)
    if (Math.abs(data.countingDifference) < 5) {
      return getRandomMessage(perfectCountMessages);
    }
    
    // Küçük fark (%2'den az)
    if (differencePercent < 2) {
      return getRandomMessage(smallDifferenceMessages);
    }
    
    // Büyük fark (%2'den fazla)
    if (differencePercent >= 2) {
      return getRandomMessage(largeDifferenceMessages);
    }
    
    // Satış performansına göre mesaj seç
    if (data.isHighSales) {
      return getRandomMessage(highSalesMessages);
    } else if (data.totalSales > 0) {
      return getRandomMessage(normalSalesMessages);
    } else {
      return getRandomMessage(lowSalesMessages);
    }
  };

  // Başlığı güncelleme fonksiyonu - tek seferde
  const updateWindowTitle = (message: string) => {
    const newTitle = `${appName} | ${message}`;

    // Sadece başlık değiştiyse güncelle (gereksiz IPC mesajlarını önle)
    if (newTitle !== lastTitle.current) {
      lastTitle.current = newTitle;

      // Electron'a başlık değişikliği mesajı gönder
      if (window.ipcRenderer) {
        window.ipcRenderer.send("update-window-title", newTitle);
      } else {
        // Tarayıcı ortamında document.title'ı güncelle
        document.title = newTitle;
      }
    }
  };

  // Uygun mesajı belirle ve başlığı güncelle
  const updateTitle = () => {
    // Özel mesaj gösteriliyorsa ve süresi dolmamışsa atla
    if (showingSpecialMessage) {
      const now = Date.now();
      if (now - specialMessageTimeRef.current < specialMessageDuration) {
        return;
      }
      // Süre dolduysa özel mesaj durumunu kapat
      setShowingSpecialMessage(false);
    }

    // Özel gün kontrolü
    const specialDayMessage = specialDateMessages();
    if (specialDayMessage) {
      updateWindowTitle(specialDayMessage);
      return;
    }

    // Haftanın günü kontrolü
    const dayMessage = dayOfWeekMessages();
    if (dayMessage && Math.random() < 0.7) {
      // %70 ihtimalle haftanın günü mesajı göster
      updateWindowTitle(dayMessage);
      return;
    }

    // Saate göre mesaj seçimi
    const now = new Date();
    const currentHour = now.getHours();

    // Rastgele mesaj kaynağı seçimi - daha fazla çeşitlilik için
    const randomSource = Math.random();

    // %10 ihtimalle komik mesaj
    if (randomSource < 0.1) {
      updateWindowTitle(getRandomMessage(funnyMessages));
      return;
    }

    // %10 ihtimalle hedef mesajı
    if (randomSource < 0.2) {
      updateWindowTitle(getRandomMessage(goalMessages));
      return;
    }

    // %20 ihtimalle genel motivasyon mesajı
    if (randomSource < 0.4) {
      updateWindowTitle(getRandomMessage(motivationalMessages));
      return;
    }

    // %60 ihtimalle saat bazlı mesaj
    // Mevcut saat için uygun mesaj grubunu bul
    const matchingTimeSlot = timeBasedMessages.find(
      (slot) => currentHour >= slot.timeStart && currentHour < slot.timeEnd
    );

    if (matchingTimeSlot) {
      // Rastgele bir mesaj seç
      const randomMessage = getRandomMessage(matchingTimeSlot.messages);
      updateWindowTitle(randomMessage);
    } else {
      // Eğer hiçbir zaman dilimine uymazsa (olmaması lazım ama) genel motivasyon mesajı göster
      updateWindowTitle(getRandomMessage(motivationalMessages));
    }
  };

  // Etkin bir zamanlamayı ayarla
  const scheduleNextUpdate = () => {
    // Zamanlayıcıyı temizle
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Mevcut zamana göre bir sonraki güncelleşme zamanını hesapla
    const now = new Date();
    let nextUpdate: Date;

    // Minimum 20 dakika, maksimum 40 dakika arasında rastgele bir süre sonra güncelle
    // Kullanıcıya daha az tahmin edilebilir ve daha eğlenceli bir deneyim sunar
    const randomMinutes = Math.floor(Math.random() * 20) + 20; // 20-40 arası rastgele sayı
    const randomUpdate = new Date(now.getTime() + randomMinutes * 60 * 1000);

    // Opsiyon 1: Sonraki saat başı (her saat başı güncelleme)
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);

    // Opsiyon 2: Sonraki periyoda geçiş (sabah, öğle, akşam vb.)
    let nextPeriodChange = null;
    const currentHour = now.getHours();

    for (const period of timeBasedMessages) {
      // Şu an kullandığımız periyottan bir sonraki periyota geçiş saati
      if (currentHour < period.timeStart) {
        const periodStart = new Date(now);
        periodStart.setHours(period.timeStart, 0, 0, 0);

        // Eğer bu geçerli bir sonraki periyotsa
        if (!nextPeriodChange || periodStart < nextPeriodChange) {
          nextPeriodChange = periodStart;
        }
      }
    }

    // Opsiyon 3: Yarın günün başlangıcı (00:00)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // En erken zamanda güncelleşme yap
    nextUpdate = randomUpdate; // Varsayılan olarak rastgele süre sonra güncelle

    // Ama periyot değişimleri, saat başları veya günün değişimi gibi önemli zamanlara öncelik ver
    if (nextHour < nextUpdate) {
      nextUpdate = nextHour;
    }
    if (nextPeriodChange && nextPeriodChange < nextUpdate) {
      nextUpdate = nextPeriodChange;
    }
    if (tomorrow < nextUpdate) {
      nextUpdate = tomorrow;
    }

    // Zamanlayıcıyı ayarla
    const timeUntilNextUpdate = nextUpdate.getTime() - now.getTime();
    timerRef.current = setTimeout(() => {
      updateTitle();
      scheduleNextUpdate(); // Sonraki güncellemeyi planla
    }, timeUntilNextUpdate);
  };

  const getRegisterOpenMessage = (): string => {
    return getRandomMessage(registerOpenMessages);
  };

  // Kasa kapanış olayını dinle
  useEffect(() => {
    // Kasa kapanış olayı dinleyicisi
    const handleCashRegisterClose = (data: CashRegisterCloseData) => {
      console.log('Kasa kapanış verileri alındı:', data);
      
      // Özel mesaj gösteriliyor olarak işaretle
      setShowingSpecialMessage(true);
      
      // Zamanı kaydet
      specialMessageTimeRef.current = Date.now();
      
      // Kasa kapanış verilerine göre mesaj seç ve göster
      const message = getCashRegisterCloseMessage(data);
      updateWindowTitle(message);
      
      // 20 dakika sonra normal mesajlara geri dön
      const resetTimer = setTimeout(() => {
        setShowingSpecialMessage(false);
        updateTitle(); // Normal mesaj döngüsüne dön
      }, specialMessageDuration);
      
      // Component unmount olursa timer'ı temizle
      return () => clearTimeout(resetTimer);
    };
    
    // Kasa açılış olayı dinleyicisi
    const handleCashRegisterOpen = (data: CashRegisterOpenData) => {
      console.log('Kasa açılış verileri alındı:', data);
      
      // Özel mesaj gösteriliyor olarak işaretle
      setShowingSpecialMessage(true);
      
      // Zamanı kaydet
      specialMessageTimeRef.current = Date.now();
      
      // Kasa açılış mesajı seç ve göster
      const message = getRegisterOpenMessage();
      updateWindowTitle(message);
      
      // 20 dakika sonra normal mesajlara geri dön
      const resetTimer = setTimeout(() => {
        setShowingSpecialMessage(false);
        updateTitle(); // Normal mesaj döngüsüne dön
      }, specialMessageDuration);
      
      // Component unmount olursa timer'ı temizle
      return () => clearTimeout(resetTimer);
    };
    
    // Olayları dinle
    eventBus.on('cashRegisterClosed', handleCashRegisterClose);
    eventBus.on('cashRegisterOpened', handleCashRegisterOpen);
    
    // Temizleme
    return () => {
      eventBus.off('cashRegisterClosed', handleCashRegisterClose);
      eventBus.off('cashRegisterOpened', handleCashRegisterOpen);
    };
  }, []);

  useEffect(() => {
    // İlk başlığı ayarla
    updateTitle();

    // Sonraki güncellemeyi planla
    scheduleNextUpdate();

    // Temizleme işlemi
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Bu bileşen herhangi bir şey render etmez
  return null;
};

export default DynamicWindowTitle;
