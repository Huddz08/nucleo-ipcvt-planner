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

O botão de exportar no topo gera um PDF dos times visíveis, respeitando os filtros. O menu de opções também permite exportar todos os times e núcleos no mesmo PDF. Para guardar uma cópia dos dados editáveis, use as opções de backup JSON nesse menu. Restaurar um backup também atualiza o planejamento compartilhado.

## Salvamento na rede

As alterações em pessoas, times, funções e anotações são salvas automaticamente no Firebase e aparecem nos outros aparelhos com o Planner aberto. O indicador no topo mostra **Salvo na rede** somente depois da confirmação do servidor. Tema, filtros e visibilidade do menu continuam sendo preferências deste navegador.

Uma cópia local é mantida neste aparelho. Sem conexão, você pode continuar editando; o indicador avisa que as alterações ainda estão locais. Ao reconectar, o Planner verifica a versão da rede antes de enviar as alterações pendentes. Se uma tentativa falhar, use **Tentar novamente** ou baixe um backup.

Na primeira abertura, ou se dois aparelhos alterarem o planejamento durante uma desconexão, podem existir versões diferentes. O Planner pede uma escolha: **Carregar da rede** abre a versão compartilhada; **Usar este planejamento** envia o planejamento atual deste aparelho. Antes da escolha, as duas versões são guardadas em uma cópia de recuperação local. Se essa cópia não puder ser gravada, a troca fica bloqueada para preservar os dados. Um aparelho novo, sem planejamento local, carrega a versão da rede automaticamente.

Ao receber uma versão de outro aparelho, o histórico de desfazer é reiniciado para evitar que uma ação antiga substitua o planejamento atualizado. A gravação local antiga, na chave `nucleo-ipcvt-planner-v1`, permanece intacta.

O projeto usa o Firebase existente, `repertorio-ipcvt`, no documento `app_ipcvt/planner_dados`. A nova versão fica no campo `plannerV2`; os campos da ferramenta anterior são preservados. As gravações usam transações com revisão para detectar alterações concorrentes. Não é necessário criar outro banco nem alterar as regras existentes para usar este projeto.

## Fotos

Adicione as imagens em `public/fotos/`, com o nome exato do integrante, incluindo acentos e espaços: `Hudson.jpg` ou `João Victor.png`, por exemplo. São aceitos JPG, JPEG, PNG e WebP; sem uma foto, aparecem as iniciais. Publique novamente o projeto após adicionar ou substituir imagens. As orientações completas estão em [public/fotos/README.md](public/fotos/README.md).

## Publicar

Na Vercel ou Netlify, use `npm run build` como comando de build e `dist` como pasta de saída. No GitHub Pages, publique o conteúdo de `dist/`. O Vite usa caminhos relativos (`base: './'`) para funcionar também em um subdiretório do repositório. Não é necessário configurar variáveis de ambiente nesta versão.
