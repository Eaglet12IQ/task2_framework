export default {
  name: "Core",
  version: "1.0.0",
  requires: [],
  register(container) {
    container.addSingleton("clock", () => ({ now: () => new Date().toISOString() }));
    container.addSingleton("storage", () => {
      const values = [];
      return {
        add(v) { values.push(v); },
        all() { return values.slice(); }
      };
    });
  },
  async init(container) {}
};
