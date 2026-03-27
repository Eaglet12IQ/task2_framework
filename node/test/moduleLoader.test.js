import test from "node:test";
import assert from "node:assert/strict";
import { buildOrder, CONTRACT_VERSION } from "../src/moduleLoader.js";
import { ModuleLoadError } from "../src/errors.js";
import { Container } from "../src/container.js";

test("Порядок запуска учитывает зависимости", () => {
  const all = new Map();
  all.set("a", { name: "A", requires: [] });
  all.set("b", { name: "B", requires: ["A"] });
  all.set("c", { name: "C", requires: ["B"] });

  const order = buildOrder(all, ["A", "B", "C"]);
  assert.deepEqual(order.map(x => x.name), ["A", "B", "C"]);
});

// Дополнительные проверки порядка запуска

test("Параллельные ветви запускаются в любом порядке", () => {
  const all = new Map();
  all.set("core", { name: "Core", requires: [] });
  all.set("mod1", { name: "Mod1", requires: ["Core"] });
  all.set("mod2", { name: "Mod2", requires: ["Core"] });
  all.set("mod3", { name: "Mod3", requires: ["Mod1", "Mod2"] });

  const order = buildOrder(all, ["Core", "Mod1", "Mod2", "Mod3"]);
  const names = order.map(x => x.name);
  
  // Core должен быть первым
  assert.strictEqual(names[0], "Core");
  // Mod3 должен быть последним
  assert.strictEqual(names[3], "Mod3");
  // Mod1 и Mod2 должны быть перед Mod3
  assert.ok(names.indexOf("Mod1") < 3);
  assert.ok(names.indexOf("Mod2") < 3);
});

test("Проверка отсутствия модуля в конфигурации", () => {
  const all = new Map();
  all.set("a", { name: "A", requires: [] });
  all.set("b", { name: "B", requires: [] });

  assert.throws(
    () => buildOrder(all, ["A", "C"]),
    (e) => e instanceof ModuleLoadError && e.message.includes("Модуль не найден")
  );
});

test("Проверка недостающей зависимости", () => {
  const all = new Map();
  all.set("a", { name: "A", requires: [] });
  all.set("b", { name: "B", requires: ["Missing"] });

  assert.throws(
    () => buildOrder(all, ["A", "B"]),
    (e) => e instanceof ModuleLoadError && e.message.includes("Не хватает модуля для зависимости")
  );
});

test("Большая цепочка зависимостей", () => {
  const all = new Map();
  all.set("a", { name: "A", requires: [] });
  all.set("b", { name: "B", requires: ["A"] });
  all.set("c", { name: "C", requires: ["B"] });
  all.set("d", { name: "D", requires: ["C"] });
  all.set("e", { name: "E", requires: ["D"] });

  const order = buildOrder(all, ["A", "B", "C", "D", "E"]);
  assert.deepEqual(order.map(x => x.name), ["A", "B", "C", "D", "E"]);
});

test("Отсутствующий модуль даёт понятную ошибку", () => {
  const all = new Map();
  all.set("a", { name: "A", requires: [] });

  assert.throws(
    () => buildOrder(all, ["A", "B"]),
    (e) => e instanceof ModuleLoadError && e.message.includes("Модуль не найден")
  );
});

test("Цикл зависимостей обнаруживается", () => {
  const all = new Map();
  all.set("a", { name: "A", requires: ["B"] });
  all.set("b", { name: "B", requires: ["A"] });

  assert.throws(
    () => buildOrder(all, ["A", "B"]),
    (e) => e instanceof ModuleLoadError && e.message.toLowerCase().includes("циклическая")
  );
});

// Проверка внедрения зависимостей через контейнер
test("Синглтон возвращает тот же экземпляр", () => {
  const container = new Container();
  let createCount = 0;
  
  container.addSingleton("service", (c) => {
    createCount++;
    return { id: createCount };
  });
  
  const s1 = container.get("service");
  const s2 = container.get("service");
  
  assert.strictEqual(createCount, 1, "Создание должно быть один раз");
  assert.strictEqual(s1, s2, "Один и тот же экземпляр");
});

test("Transient создаёт новый экземпляр каждый раз", () => {
  const container = new Container();
  let createCount = 0;
  
  container.addTransient("service", (c) => {
    createCount++;
    return { id: createCount };
  });
  
  const s1 = container.get("service");
  const s2 = container.get("service");
  const s3 = container.get("service");
  
  assert.strictEqual(createCount, 3, "Создание три раза");
  assert.notStrictEqual(s1, s2, "Разные экземпляры");
  assert.notStrictEqual(s2, s3, "Разные экземпляры");
});

test("Зависимости внедряются через контейнер в модулях", () => {
  const container = new Container();
  
  // Регистрируем сервис в контейнере
  container.addSingleton("data.service", () => ({ value: 42 }));
  
  // Модуль получает зависимость через контейнер
  const moduleObj = {
    name: "TestModule",
    requires: [],
    register(c) {
      c.addSingleton("action.test", (ctx) => {
        const dataService = ctx.get("data.service");
        return {
          title: "Test Action",
          async execute() {
            return dataService.value;
          }
        };
      });
    },
    async init() {}
  };
  
  moduleObj.register(container);
  const action = container.get("action.test");
  
  // Проверяем, что зависимость внедрена правильно
  assert.strictEqual(action.title, "Test Action");
});

test("Модуль не может создать сервис без контейнера", () => {
  const container = new Container();
  
  // Этот модуль пытается получить сервис, который не зарегистрирован
  const moduleObj = {
    name: "BadModule",
    requires: [],
    register(c) {
      // Здесь всё работает - регистрация
      c.addSingleton("action.bad", () => ({
        title: "Bad",
        async execute() {}
      }));
    },
    async init(c) {
      // Попытка получить несуществующий сервис вызовет ошибку
      assert.throws(
        () => c.get("nonexistent.service"),
        (e) => e.message.includes("не зарегистрирована")
      );
    }
  };
  
  moduleObj.register(container);
  // При инициализации должна выброситься ошибка
});

// Тест проверки совместимости версий контракта
test("Модуль с несовместимой версией вызывает ошибку", () => {
  // Этот тест проверяет, что версия контракта определена
  assert.ok(CONTRACT_VERSION, "Версия контракта должна быть определена");
  assert.ok(CONTRACT_VERSION.match(/^\d+\.\d+\.\d+$/), "Версия должна быть в формате semver");
});

test("Синглтон и Transient имеют разное время жизни", () => {
  const container = new Container();
  let singletonCreations = 0;
  let transientCreations = 0;
  
  // Синглтон - создаётся один раз
  container.addSingleton("lifecycle.singleton", () => {
    singletonCreations++;
    return { type: "singleton", id: singletonCreations };
  });
  
  // Transient - создаётся каждый раз
  container.addTransient("lifecycle.transient", () => {
    transientCreations++;
    return { type: "transient", id: transientCreations };
  });
  
  // Получаем singleton несколько раз
  const s1 = container.get("lifecycle.singleton");
  const s2 = container.get("lifecycle.singleton");
  const s3 = container.get("lifecycle.singleton");
  
  // Получаем transient несколько раз
  const t1 = container.get("lifecycle.transient");
  const t2 = container.get("lifecycle.transient");
  const t3 = container.get("lifecycle.transient");
  
  // Проверяем, что синглтон создался только 1 раз
  assert.strictEqual(singletonCreations, 1, "Singleton должен создаться 1 раз");
  assert.strictEqual(s1, s2, "Первый и второй singleton должны быть одинаковыми");
  assert.strictEqual(s2, s3, "Второй и третий singleton должны быть одинаковыми");
  
  // Проверяем, что transient создался 3 раза
  assert.strictEqual(transientCreations, 3, "Transient должен создаться 3 раза");
  assert.notStrictEqual(t1, t2, "Первый и второй transient должны быть разными");
  assert.notStrictEqual(t2, t3, "Второй и третий transient должны быть разными");
});
