/* MusikBox persistence — localStorage (persists in the Capacitor WebView).
   Optional Capacitor Preferences plugin is used when available for robustness. */
(function (global) {
  "use strict";
  const PREFIX = "musikbox.v2.";
  const hasNative = typeof Capacitor !== "undefined" &&
                    Capacitor.Plugins && Capacitor.Plugins.Preferences;

  function nativeGet(k) { return Capacitor.Plugins.Preferences.get({ key: PREFIX + k }); }
  function nativeSet(k, v) { return Capacitor.Plugins.Preferences.set({ key: PREFIX + k, value: JSON.stringify(v) }); }

  const Store = {
    // synchronous cached read from localStorage
    get(key, dflt) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? dflt : JSON.parse(raw);
      } catch (e) { return dflt; }
    },
    set(key, val) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) {}
      if (hasNative) nativeSet(key, val);
    },
    // async hydrate (use Preferences-backed values over localStorage when present)
    async hydrate() {
      if (!hasNative) return;
      try {
        const keys = ["settings", "favorites", "playlists", "history", "queue", "localIndex", "downloaded", "onboarding", "lang"];
        for (const k of keys) {
          const r = await nativeGet(k);
          if (r.value != null) {
            const v = JSON.parse(r.value);
            try { localStorage.setItem(PREFIX + k, r.value); } catch (e) {}
          }
        }
      } catch (e) {}
    },
  };

  global.Store = Store;

  // -------- Default state model --------
  global.DB = {
    settings: null,
    favorites: [],
    playlists: [],      // [{id,name,trackKeys}]
    history: [],        // [{...track, at}]
    queue: [],          // [{...track}]
    localIndex: {},     // normalized path -> {key,title,artist,album,genre,duration,uri,mime,size}
    downloaded: [],     // [{key,title,fileUri,size,added}]
  };

  function loadAll() {
    const s = Store.get("settings", {});
    DB.settings = Object.assign({
      lang: "fr",
      onboardingDone: false,
      mood: "emotion",
      dream: false,
      repeat: "off",
      shuffle: false,
    }, s);
    DB.favorites   = Store.get("favorites", []);
    DB.playlists   = Store.get("playlists", []);
    DB.history     = Store.get("history", []);
    DB.queue       = Store.get("queue", []);
    DB.localIndex  = Store.get("localIndex", {});
    DB.downloaded  = Store.get("downloaded", []);
    I18N.set(DB.settings.lang);
  }
  function persistSettings()  { Store.set("settings", DB.settings); }
  function persistFavorites() { Store.set("favorites", DB.favorites); }
  function persistPlaylists() { Store.set("playlists", DB.playlists); }
  function persistHistory()   { Store.set("history", DB.history); }
  function persistQueue()     { Store.set("queue", DB.queue); }
  function persistLocal()     { Store.set("localIndex", DB.localIndex); }
  function persistDownloaded(){ Store.set("downloaded", DB.downloaded); }

  global.loadAll = loadAll;
  global.persistSettings  = persistSettings;
  global.persistFavorites = persistFavorites;
  global.persistPlaylists = persistPlaylists;
  global.persistHistory   = persistHistory;
  global.persistQueue     = persistQueue;
  global.persistLocal     = persistLocal;
  global.persistDownloaded= persistDownloaded;
})(window);
