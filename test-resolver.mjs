// ponytail: o codigo usa imports sem extensao (estilo bundler, resolvido pelo Vite).
// O loader ESM do Node exige extensao, entao completamos com .ts so ao rodar os testes.
// Se um dia o projeto adotar imports com extensao explicita, este arquivo sai.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[mc]?[jt]sx?$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // nao era um .ts; segue a resolucao normal abaixo
      }
    }
    return next(specifier, context);
  },
});
