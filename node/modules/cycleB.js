// Модуль B - конец цикла (зависит от A)
export default {
  name: "ModuleB",
  version: "1.0.0",
  requires: ["ModuleA"],
  register(container) {
    container.addSingleton("action.moduleB", () => ({
      title: "Module B",
      async execute() { console.log("B"); }
    }));
  },
  async init(container) {}
};
