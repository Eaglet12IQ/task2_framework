/**
 * Внешний модуль - загружается из отдельной папки external-modules
 * Демонстрирует возможность расширения без изменения основной директории модулей
 */

export default {
  name: "ExternalModule",
  version: "1.0.0",
  requires: ["Core"],
  register(container) {
    // Регистрируем действие
    container.addSingleton("action.external", () => ({
      title: "Внешний модуль",
      async execute() {
        console.log("Сообщение от внешнего модуля!");
      }
    }));
    
    // Демонстрация: показываем, что используем singleton из Core
    const clock = container.get("clock");
    console.log(`[ExternalModule] Время из Core: ${clock.now()}`);
  },
  async init(container) {
    console.log("[ExternalModule] Инициализация завершена");
  }
};
