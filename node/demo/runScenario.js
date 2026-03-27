/**
 * Демонстрационный скрипт для запуска разных сценариев
 * 
 * Использование: node demo/runScenario.js <config>
 * 
 * Доступные конфигурации:
 *   basic   - базовый набор (Core + Logging)
 *   full    - полный набор (все модули)
 *   missing - отсутствующий модуль
 *   cycle   - циклическая зависимость
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModulesFromConfig, buildOrder, CONTRACT_VERSION } from "../src/moduleLoader.js";
import { Container } from "../src/container.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configs = {
  basic: "config/basic.json",
  full: "config/modules.json", 
  missing: "config/missing.json",
  cycle: "config/cycle.json",
  "with-external": "config/with-external.json",
  "with-incompatible": "config/with-incompatible.json"
};

const configName = process.argv[2] || "full";
const configPath = configs[configName];

if (!configPath) {
  console.error(`Неизвестная конфигурация: ${configName}`);
  console.log(`Доступные: ${Object.keys(configs).join(", ")}`);
  process.exit(1);
}

const fullConfigPath = path.resolve(__dirname, "..", configPath);
const modulesDir = path.resolve(__dirname, "..", "modules");
const externalModulesDir = path.resolve(__dirname, "..", "external-modules");

console.log(`=== Демонстрация: ${configName} ===`);
console.log(`Конфигурация: ${fullConfigPath}`);
console.log(`Версия контракта: ${CONTRACT_VERSION}`);
console.log("");

async function run() {
  try {
    const all = await loadModulesFromConfig(fullConfigPath, modulesDir, externalModulesDir);
    
    const enabledNames = [];
    for (const [_, m] of all) {
      enabledNames.push(m.name);
    }
    
    console.log("Загруженные модули:", enabledNames.join(", "));
    
    const ordered = buildOrder(all, enabledNames);
    console.log("Порядок запуска:", ordered.map(m => m.name).join(" -> "));
    
    const container = new Container();
    
    console.log("\nРегистрация служб...");
    for (const m of ordered) {
      if (typeof m.register === "function") {
        m.register(container);
      }
    }
    
    console.log("Инициализация модулей...");
    for (const m of ordered) {
      if (typeof m.init === "function") {
        await m.init(container);
      }
    }
    
    const actions = container.getMany("action.");
    console.log("\nЗапуск действий:");
    for (const act of actions) {
      console.log(`  - ${act.title}`);
      await act.execute();
    }
    
    console.log("\n✓ Успешно выполнено");
    
  } catch (error) {
    console.error("\n✗ Ошибка:", error.message);
    console.error("  Тип:", error.name);
    process.exit(1);
  }
}

run();
