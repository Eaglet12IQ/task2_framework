// Модуль A - начало цикла
export default {
  name: "ModuleA",
  requires: ["ModuleB"],
  register(container) {
    container.addSingleton("action.moduleA", () => ({
      title: "Module A",
      async execute() { console.log("A"); }
    }));
  },
  async init(container) {}
};
