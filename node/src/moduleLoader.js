import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ModuleLoadError } from "./errors.js";

// Версия контракта модуля (должна поддерживаться модулями)
export const CONTRACT_VERSION = "1.0.0";

/**
 * Проверяет совместимость версии контракта модуля с версией ядра
 */
function checkContractCompatibility(moduleObj, fileName) {
  const moduleVersion = moduleObj.version || "0.0.0";
  
  // Проверяем наличие обязательных полей контракта
  if (!moduleObj.name || typeof moduleObj.name !== "string") {
    throw new ModuleLoadError(
      `Модуль ${fileName} не имеет имени или имя не является строкой`
    );
  }
  
  if (!Array.isArray(moduleObj.requires)) {
    throw new ModuleLoadError(
      `Модуль ${moduleObj.name} не имеет списка requires или он не является массивом`
    );
  }
  
  if (typeof moduleObj.register !== "function") {
    throw new ModuleLoadError(
      `Модуль ${moduleObj.name} не имеет метода register`
    );
  }
  
  if (typeof moduleObj.init !== "function") {
    throw new ModuleLoadError(
      `Модуль ${moduleObj.name} не имеет метода init`
    );
  }
  
  // Проверяем совместимость версий (простая проверка мажорной версии)
  const [coreMajor] = CONTRACT_VERSION.split(".").map(Number);
  const [modMajor] = moduleVersion.split(".").map(Number);
  
  if (modMajor > coreMajor) {
    throw new ModuleLoadError(
      `Модуль ${moduleObj.name} (v${moduleVersion}) несовместим с ядром (v${CONTRACT_VERSION}) - требуется обновление ядра`
    );
  }
  
  return { moduleVersion, isCompatible: modMajor === coreMajor };
}

/**
 * Загружает модули из указанной директории
 */
async function loadModulesFromDir(modulesDir, dirName) {
  const loaded = new Map();

  try {
    const files = await fs.readdir(modulesDir);
    
    for (const file of files) {
      if (!file.endsWith(".js")) continue;
      
      const full = path.resolve(modulesDir, file);
      const mod = await import(pathToFileURL(full));
      const moduleObj = mod.default;
      
      if (!moduleObj) {
        throw new ModuleLoadError(`Модуль в файле ${file} не экспортирует default`);
      }
      
      // Проверяем совместимость контракта
      const compatibility = checkContractCompatibility(moduleObj, file);
      console.log(`  [${dirName}] Загружен: ${moduleObj.name} v${compatibility.moduleVersion}${compatibility.isCompatible ? "" : " (может быть несовместим)"}`);
      
      loaded.set(moduleObj.name.toLowerCase(), moduleObj);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      // Директория не существует - это нормально для внешних модулей
      console.log(`  [${dirName}] Директория не найдена, пропускаем`);
    } else {
      throw err;
    }
  }
  
  return loaded;
}

export async function loadModulesFromConfig(configPath, modulesDir, externalModulesDir = null) {
  const raw = await fs.readFile(configPath, "utf8");
  const cfg = JSON.parse(raw);

  const files = cfg.modules ?? [];
  const loaded = new Map();

  console.log("Загрузка модулей...");
  for (const file of files) {
    const full = path.resolve(modulesDir, file);
    let moduleObj;
    
    try {
      const mod = await import(pathToFileURL(full));
      moduleObj = mod.default;
    } catch (e) {
      // Файл не найден в modules/, пробуем external-modules/
      if (externalModulesDir && file.endsWith('.js')) {
        const extFull = path.resolve(externalModulesDir, file);
        const mod = await import(pathToFileURL(extFull));
        moduleObj = mod.default;
      } else {
        throw e;
      }
    }

    if (!moduleObj || typeof moduleObj.name !== "string") {
      throw new ModuleLoadError(`Некорректный модуль, файл ${file}`);
    }

    // Проверяем контракт
    checkContractCompatibility(moduleObj, file);
    
    loaded.set(moduleObj.name.toLowerCase(), moduleObj);
  }

  return loaded;
}

export function buildOrder(all, enabledNames) {
  const enabled = new Map();

  for (const name of enabledNames) {
    const key = name.toLowerCase();
    const moduleObj = all.get(key);
    if (!moduleObj) {
      throw new ModuleLoadError(`Модуль не найден, имя модуля ${name}`);
    }
    enabled.set(key, moduleObj);
  }

  for (const moduleObj of enabled.values()) {
    const req = moduleObj.requires ?? [];
    for (const r of req) {
      if (!enabled.has(r.toLowerCase())) {
        throw new ModuleLoadError(`Не хватает модуля для зависимости, модуль ${moduleObj.name} требует ${r}`);
      }
    }
  }

  const indeg = new Map();
  const edges = new Map();

  for (const [k, m] of enabled) {
    indeg.set(k, 0);
    edges.set(k, []);
  }

  for (const [k, m] of enabled) {
    const req = m.requires ?? [];
    for (const r0 of req) {
      const r = r0.toLowerCase();
      edges.get(r).push(k);
      indeg.set(k, indeg.get(k) + 1);
    }
  }

  const q = [];
  for (const [k, v] of indeg) {
    if (v === 0) q.push(k);
  }

  const result = [];
  while (q.length > 0) {
    const k = q.shift();
    result.push(enabled.get(k));
    for (const to of edges.get(k)) {
      indeg.set(to, indeg.get(to) - 1);
      if (indeg.get(to) === 0) q.push(to);
    }
  }

  if (result.length !== enabled.size) {
    const stuck = [];
    for (const [k, v] of indeg) {
      if (v > 0) stuck.push(enabled.get(k).name);
    }
    throw new ModuleLoadError(`Обнаружена циклическая зависимость модулей, проблемные модули ${stuck.join(", ")}`);
  }

  return result;
}
