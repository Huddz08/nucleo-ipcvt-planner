# Planner IPCVT

Quadro visual para montar equipes de Louvor, Litúrgicos e Mídia e experimentar a distribuição das pessoas entre funções. O projeto mantém a estrutura React + Vite e pode substituir os arquivos do repositório anterior no GitHub.

## Executar

```bash
npm install
npm run dev
```

Para gerar a versão de publicação e verificar as regras do Planner:

```bash
npm run build
npm test
```

`npm run preview` abre uma prévia da versão gerada em `dist/`.

## Usar o quadro

Crie, duplique, renomeie ou apague times completos. Cada time guarda suas próprias atribuições nas três áreas; o filtro permite olhar uma área isolada. Grupos, subgrupos e cargos podem ser ampliados conforme a organização precisar.

Em Vocal, a ordem inicial é Voz Guia, Soprano, Contralto e Tenor. A inclusão de Voz Guia nos planejamentos antigos mantém as atribuições existentes.

Em Instrumental, a ordem inicial é Violão, Guitarra, Baixo, Piano, Bateria e Violino. Planejamentos antigos recebem a nova ordem sem alterar os integrantes das funções.

Arraste um integrante do menu para um cargo. O menu sempre cria uma nova atribuição, então a mesma pessoa pode exercer mais de uma função. Arrastar entre cargos move a atribuição de origem; segure **Alt** para copiar. Clique na logo IPCVT para abrir ou recolher o menu de integrantes.

O quadro ocupa toda a área disponível por padrão. A barra superior verde reúne os controles, incluindo a alternância entre os modos claro e escuro. A preferência de tema fica salva neste navegador.

Todos os times aparecem um abaixo do outro e são editáveis no mesmo quadro. Um time novo entra na lista automaticamente. Cada formação se ajusta à largura disponível, sem rolagem lateral. No tablet em pé, Louvor ocupa a faixa superior, com Vocal, Instrumental e Técnica; Litúrgicos e Mídia ficam lado a lado abaixo. Em telas mais largas, os três grupos cabem na mesma faixa. Os cards se distribuem em linhas compactas para mostrar o time completo no tablet e computador. Continuam aceitando mais de duas pessoas por função. Em telas pequenas, ou com mais cargos e anotações abertas, o quadro pode continuar para baixo, preservando todo o conteúdo. A barra superior reúne os filtros de time e seção (Geral, Louvor, Litúrgicos e Mídia), configuração e demais controles.

**Limpar time** retira todos os integrantes das funções da formação escolhida, inclusive das seções ocultas pelo filtro. A estrutura, as anotações, o cadastro de pessoas e os outros times são preservados. É possível desfazer a limpeza. Arrastar entre times move apenas a atribuição de origem; segure **Alt** para copiar.

O Time A começa com a distribuição da ferramenta anterior como rascunho. Os times B e C começam vazios. Repertório e Eventos foram removidos da estrutura; planejamentos salvos e backups antigos são ajustados ao abrir, preservando o cadastro de pessoas, as outras funções e as anotações. Câmera continua disponível em Mídia.

O botão de exportar no topo gera um PDF dos times visíveis, respeitando os filtros. O menu de opções também permite exportar todos os times e núcleos no mesmo PDF. Para guardar os dados editáveis ou transferi-los para outro aparelho, use as opções de backup JSON nesse menu.

As alterações são salvas automaticamente neste navegador. Os dados já salvos na versão anterior são preservados. Esta versão não sincroniza dados pelo Firebase. `src/firebase.js` foi mantido como arquivo legado e não é utilizado. A gravação local antiga, na chave `nucleo-ipcvt-planner-v1`, permanece intacta.

## Fotos

Adicione as imagens em `public/fotos/`, com o nome exato do integrante, incluindo acentos e espaços: `Hudson.jpg` ou `João Victor.png`, por exemplo. São aceitos JPG, JPEG, PNG e WebP; sem uma foto, aparecem as iniciais. Publique novamente o projeto após adicionar ou substituir imagens. As orientações completas estão em [public/fotos/README.md](public/fotos/README.md).

## Publicar

Na Vercel ou Netlify, use `npm run build` como comando de build e `dist` como pasta de saída. No GitHub Pages, publique o conteúdo de `dist/`. O Vite usa caminhos relativos (`base: './'`) para funcionar também em um subdiretório do repositório. Não é necessário configurar variáveis de ambiente nesta versão.
