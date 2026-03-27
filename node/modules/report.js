export default {
  name: "Report",
  version: "1.0.0",
  requires: ["Core", "Export"],
  register(container) {
    container.addSingleton("action.report", () => {
      const clock = container.get("clock");
      const storage = container.get("storage");
      return {
        title: "Формирование отчёта",
        async execute() {
          const count = storage.all().length;
          console.log(`Отчёт сформирован, время ${clock.now()}, записей ${count}`);
        }
      };
    });
  },
  async init(container) {}
};
