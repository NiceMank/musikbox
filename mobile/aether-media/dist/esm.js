/* AetherMedia — JS proxy for the local music scanner.
   Native registration is automatic on Android (auto-plugin); this module just
   exposes the typed proxy for apps that import it. */
const { registerPlugin } = require('@capacitor/core');

const AetherMedia = registerPlugin('AetherMedia', {
  web: () => ({
    checkPermission: async () => ({ granted: false, unsupported: true }),
    requestPermission: async () => ({ granted: false, unsupported: true }),
    getAudio: async () => ({ items: [], unsupported: true }),
  }),
});

module.exports = AetherMedia;
export default AetherMedia;
