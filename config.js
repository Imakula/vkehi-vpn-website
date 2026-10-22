/* ==========================================================================
   VKEHI VPN - Official Configuration
   ========================================================================== */

window.VKEHI_CONFIG = {
  brandName: "VKEHI VPN",
  tagline: "Secure Connections. Fast Performance. Trusted VPN Solutions in Sri Lanka.",
  version: "v2.5.0",
  
  // Support & Contact Information
  whatsappNumber: "+94769196703",
  whatsappLink: "https://wa.me/94769196703?text=Hello%20VKEHI%20VPN%2C%20I%20need%20assistance",
  telegramSupport: "https://t.me/VK_EHI_CONTAC",
  telegramChannel: "https://t.me/VK_EHI_CONTAC",
  telegramUsername: "@VK_EHI_CONTAC",

  // 3x-UI Server Panel Configuration
  panelUrl: "https://paidsv2ray.vkehi.store:27614/jvDDD4iJyK2ybbe8Wh/panel/",
  panelUser: "vk",
  panelPass: "vk",

  // Multi-Bank Payment Details for Sri Lanka
  banks: [
    {
      id: "sampath",
      bankName: "SAMPATH BANK",
      accountNumber: "122452813222",
      accountName: "K.A.V Imakula",
      branch: "KESBEWA",
      color: "#ea580c",
      badge: "Fast Verification",
      iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2L2 7h20L12 2z"/></svg>'
    },
    {
      id: "boc",
      bankName: "BOC BANK (Bank of Ceylon)",
      accountNumber: "0089457035",
      accountName: "K.A.V Imakula",
      branch: "KESBEWA",
      color: "#f59e0b",
      badge: "Instant Transfer",
      iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
    },
    {
      id: "peoples",
      bankName: "PEOPLES BANK",
      accountNumber: "327200140031953",
      accountName: "K.A.V IMAKULA",
      branch: "Kesbewa",
      color: "#8b5cf6",
      badge: "All Branches",
      iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h2"/></svg>'
    }
  ],

  // Default payment details format for compatibility
  paymentDetails: {
    bank: {
      bankName: "SAMPATH BANK",
      accountName: "K.A.V Imakula",
      accountNumber: "122452813222",
      branch: "KESBEWA",
      note: "Please upload your transfer slip or screenshot after deposit."
    },
    binance: {
      payId: "89234105",
      nickname: "VKEHI_VIP",
      note: "Binance Pay ID transfer. Upload payment screenshot."
    },
    lankaQr: {
      merchantName: "VKEHI VPN SERVICES",
      note: "Dialog Genie, eZ Cash, iPay, Commercial Q+ or any Sri Lankan banking app."
    }
  },

  // Supabase Configuration
  supabaseUrl: "https://mlloszlbbtudmdtzblsu.supabase.co",
  supabaseAnonKey: "sb_publishable_YCitodRwjD-HantHdGxjDg_DV6CAUKz"
};
