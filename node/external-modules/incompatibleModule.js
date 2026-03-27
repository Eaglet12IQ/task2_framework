/**
 * Модуль с несовместимой версией (2.0.0 > 1.0.0)
 * Должен вызвать ошибку при загрузке
 */

export default {
  name: "IncompatibleModule",
  version: "2.0.0",
  requires: ["Core"],
  register(container) {
    container.addSingleton("action.incompatible", () => ({
      title: "Несовместимый модуль",
      async execute() { console.log("Этот код не должен выполниться"); }
    }));
  },
  async init(container) {}
};
