export default {
  name: "Logging",
  version: "1.0.0",
  requires: ["Core"],
  register(container) {
    container.addSingleton("action.logging", () => ({
      title: "Проверка журнала событий",
      async execute() {
        console.log("Сообщение из модуля журналирования");
      }
    }));
  },
  async init(container) {}
};
