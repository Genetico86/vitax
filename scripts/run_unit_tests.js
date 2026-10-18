/**
 * VITAX Unit Test Runner
 * Exécute la suite de tests unitaires Vitax sans dépendance externe lourde
 */
require('./mock_test_env.js');
const fs = require('fs');
const ts = require('typescript');

require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(transpiled, filename);
};

async function main() {
  console.log('⚡ Démarrage de la suite de tests unitaires Vitax...');
  const start = Date.now();
  try {
    const { runVitaxUnitTests } = require('../src/__tests__/vitaxCore.test.ts');
    const result = await runVitaxUnitTests();
    const elapsed = Date.now() - start;

    console.log(`\n========================================`);
    console.log(`🎉 VITAX TESTS RÉUSSIS : ${result.passed} modules testés en ${elapsed}ms`);
    console.log(`========================================`);
    result.names.forEach((name, idx) => {
      console.log(`  ✅ [${idx + 1}/${result.passed}] ${name}`);
    });
    console.log(`\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ ÉCHEC D'UN TEST UNITAIRE VITAX :`);
    console.error(error);
    process.exit(1);
  }
}

main();
