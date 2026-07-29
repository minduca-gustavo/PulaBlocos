async function iniciaGran() {
    if (!location.origin.includes(PAGINAS.questoes)) return
    let cabecalho = await aguardarElemento('header')
    if (!cabecalho) return
    let divRemove = document.querySelectorAll('[id*="pulaBlocos"]')
    for (d of divRemove){
        d.remove()
    }
    
    let div = criaDiv({
        id: 'pulaBlocos_div',
        ancestral: '.questoes-navbar',
        gap: '4px'
    })
    let t = 0
    let largura = Math.floor(100 / [Object.entries(PAGINAS.tiposDeBotoes)].length) + '%'
    let modoArmazenado = await obterArmazenamento('materiasEstudadas') || {}
    let modo = modoArmazenado.atual?.modo || 'facilCertoErrado'
    relatar('modo', modo, 'roxo')
    let mapaFuncoes = {
        gerenciar,
        alteraTipo,
        assuntos
    }
    for (let [nomeTipo, dados] of Object.entries(PAGINAS.tiposDeBotoes)) {
        //console.log(nomeTipo, dados)
        let tipoId = 'pulaBlocos_' + nomeTipo
        let [funcao, parametros] = ['', {}]
        let cor = modo == nomeTipo ? '#d62839' : 'primaria'
        if (dados?.url){
            funcao = alteraTipo
            parametros = [dados?.url, nomeTipo, tipoId]
        } else if (dados?.materiaOuAssunto) {
            funcao = assuntos
            parametros = [dados?.materiaOuAssunto]
        } else if (dados?.acao) {
            funcao = dados?.acao
            parametros = []
        }
        let botao = criaBotao({
            id: tipoId,
            texto: dados.texto,
            ancestral: '#pulaBlocos_div',
            cor: dados?.url ? cor : '#386641',
            acao: () => mapaFuncoes[funcao](...parametros),
        })
        botao.style.width = largura
        botao.style.maxWidth = '185px'
        t++
    }
    

    async function assuntos(materiaAssuntoAtuais) {
        let valores = {
            materia: {
                somaMateria: 1,
                somaAssunto: 0
            },
            assunto: {
                somaMateria: 0,
                somaAssunto: 1
            },
            atuais: {
                somaMateria: 0,
                somaAssunto: 0
            }
        }
        let{idMateria, idAssunto} = await defineIdAssuntos(valores[materiaAssuntoAtuais].somaMateria, valores[materiaAssuntoAtuais].somaAssunto)
        let blocoArray = []
        blocoArray.push(idAssunto)
        relatar(idMateria)
        relatar(idAssunto)
        relatar('blocoArray', blocoArray, 'roxo')
        return {idMateria: idMateria, blocoArray: blocoArray}
    }
    
    async function defineIdAssuntos(somaMateria = 0, somaAssunto = 0) {
        let materiasEstudadas = await obterArmazenamento('materiasEstudadas') || {}
        let materias = await obterArmazenamento('materias') || []
        let materiaAtualNome = materiasEstudadas?.atual?.materia || ''
        let materiaAtualIndex = materias.findIndex(d => d.nome == materiaAtualNome) || null
        if (materiaAtualIndex < 0) materiaAtualIndex = 0
        let indiceMateriaGarantido = materias?.length <= materiaAtualIndex + somaMateria ? 0 : materiaAtualIndex + somaMateria
        let assuntoAtualNome = (materiasEstudadas?.materias.find(d=> d?.nome == materiaAtualNome)).assunto || ''
        let assuntoAtualIndex = materias[indiceMateriaGarantido]?.assuntos.findIndex(d => d?.indice.replace(/^\d+\./, "") + ' ' + d?.nome == assuntoAtualNome) || 0
        if (assuntoAtualIndex < 0) assuntoAtualIndex = 0
        let indiceAssuntoGarantido = materias[indiceMateriaGarantido]?.assuntos?.length <= assuntoAtualIndex + somaAssunto ? 0 : assuntoAtualIndex + somaAssunto
        return {idMateria: materias[indiceMateriaGarantido]?.id, idAssunto: materias[indiceMateriaGarantido]?.assuntos[indiceAssuntoGarantido]?.id}
    }

    async function alteraTipo(url, nome, tipoId){
        let materiasEstudadas = await obterArmazenamento('materiasEstudadas')
        let materias = await obterArmazenamento('materias')
        materiasEstudadas.atual.modo = nome
        let {idMateria, blocoArray} = await assuntos('atuais')
        relatar ('85: ', JSON.stringify(blocoArray), 'verde')
        for (let [nomeTipo, dados] of Object.entries(PAGINAS.tiposDeBotoes)) {
            
            let tipoId = '#pulaBlocos_' + nomeTipo
            let botao = document.querySelector(tipoId)
            let corResolver = ''
            if (dados?.url){
                if (nomeTipo == nome ){
                    corResolver = '#d62839'
                } else {
                    corResolver = 'primaria'
                }
                let { cor: corBase, corHover, texto: corTexto } = _ui_resolveCor(corResolver)
                botao.style.background = corBase
                _ui_hoverBotao(botao, corBase, corHover)
            }
        }
        await armazenar({materiasEstudadas: materiasEstudadas})
        let urlNavegar = url + '&assunto=' + idMateria + '%2C' + blocoArray.join('%2C')
        await navegar(urlNavegar, {novaAba: false})
        relatar('materiasEstudadas', materiasEstudadas, 'azul')
        relatar('materias', materias, 'azul')
        relatar('url', url, 'azul')
        relatar('urlNavegar', urlNavegar, 'azul')
        relatar('tipoId', tipoId, 'azul')
        //materiasEstudadas?.atual?.modo = 
        relatar('materiasEstudadas', materiasEstudadas, 'roxo')

    }

    async function gerenciar() {
        let divAnterior = [...document.querySelectorAll('[id*=pulaBlocos_divGerenciar]')]
        if (divAnterior.length>0) {
            divAnterior.map(d=> d.remove())
            return
        }
        let divGerenciar = criaDiv({
            id: 'pulaBlocos_divGerenciar',
            ancestral: '.questoes-navbar',
            gap: '4px',
            rowColumn: 'row'
        })
        let materias = await obterArmazenamento('pulaBlocos')
        let materiaAtual = materias?.atual ? materias?.atual : 'Selecione uma matéria.'
        let opcoes = ['Selecione uma matéria.']
        if (materias?.materias){
            for (m of materias?.materias){
                opcoes.push(m?.nome)
            }
        }
        
        let divGerenciarCorpo = criaDiv({
            id: 'pulaBlocos_divGerenciar_corpo',
            ancestral: '.questoes-navbar',
            gap: '4px',
            rowColumn: 'row'
        })
        
        //  secoes a criar:
        //  inputBlocos
        //  inputExcluir
        //  remove blocos e remove excluir
        //  
        //
        //
        let secoesGerenciar = [
            {
                nome:   'input',
                peso:   2
            },
            {
                nome:   'botoes',
                peso:   1
            },
            {
                nome:   'editar',
                peso:   2
            },
        ]
        let token = await obterArmazenamento('blocosTokenGranAuthorization') || []
        relatar('174g: ', token)
        let tokenObjeto = {
            id: 'atualizaMaterias',
            acao: 'atualizaMaterias',
            texto: 'Atualiza matérias'
        }
        if (token.length == 0){
            tokenObjeto.id = 'atualizaPagina'
            tokenObjeto.acao = 'atualizaPagina'
            tokenObjeto.texto = 'Atualiza página'
        }
        relatar('174g: ', tokenObjeto)
        let elementosGerenciar = [
            //{
            //    tipo: 'criaTitulo',
            //    id: 'tituloBlocos',
            //    texto: 'Cria blocos',
            //    coluna: 'input',
            //},
            //{
            //    tipo: 'criaTexto',
            //    id: 'tituloBlocos',
            //    texto: 'Copie e cole os assuntos para criar blocos.',
            //    coluna: 'input',
            //},
            {
                tipo: 'criaInput',
                id: 'inputSalvar',
                placeholder: 'Cole aqui + enter ou clique no botão para montar blocos.',
                acao: 'salvarExcluir',
                parametros: ['salvar', '#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'input'
            },
            {
                tipo: 'criaBotao',
                id: tokenObjeto.id,
                acao: tokenObjeto.acao,
                texto: tokenObjeto.texto,
                parametros: ['#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'salvaBloco',
                acao: 'salvarExcluir',
                texto: 'Salvar como bloco',
                parametros: ['blocos', '#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            {
                tipo: 'criaBotao',
                id: 'excluiAssunto',
                acao: 'salvarExcluir',
                texto: 'Excluir assuntos da "rodagem"',
                parametros: ['excluir', '#pulaBlocos_divGerenciar_inputSalvar'],
                coluna: 'botoes'
            },
            //{
            //    tipo: 'criaTitulo',
            //    id: 'tituloBlocos',
            //    texto: 'Exclui assuntos',
            //    coluna: 'botoes',
            //},
            //{
            //    tipo: 'criaTexto',
            //    id: 'tituloBlocos',
            //    texto: 'Copie e cole os assuntos que devem ser excluídos, ou seja, não "rodarão".',
            //    coluna: 'botoes',
            //},
            //{
            //    tipo: 'criaInput',
            //    id: 'inputExcluir',
            //    placeholder: 'Cole aqui + enter ou clique no botão para excluir assuntos.',
            //    acao: 'salvarExcluir',
            //    parametros: ['excluir', '#pulaBlocos_divGerenciar_inputExcluir'],
            //    coluna: 'botoes'
            //},
            //{
            //    tipo: 'criaBotao',
            //    id: 'inputBotao',
            //    acao: 'salvarExcluir',
            //    texto: 'Excluir assuntos',
            //    parametros: ['excluir', '#pulaBlocos_divGerenciar_inputExcluir'],
            //    coluna: 'botoes'
            //},
            {
                tipo: 'criaTitulo',
                id: 'pulaBlocos_divGerenciar_titulo',
                ancestral: '#pulaBlocos_divGerenciar',
                texto: 'Matéria atual:',
                coluna: 'editar',
            },
            {
                tipo: 'criaMenuSuspenso',
                id: 'pulaBlocos_divGerenciar_menu',
                ancestral: '#pulaBlocos_divGerenciar',
                valorInicial: materiaAtual,
                opcoes: opcoes,
                coluna: 'editar',
            },

        ]
        let mapaFuncoesGerenciar = {
            criaTitulo,
            criaTexto,
            criaInput,
            criaBotao,
            criaMenuSuspenso,
            criaBotaoComCheckbox,
            salvarExcluir,
            atualizaMaterias,
            atualizaPagina,
        }
        let secoesTamanho = 0
        secoesGerenciar.map(d=> {secoesTamanho = secoesTamanho + d?.peso})
        console.log(secoesTamanho)
        let colunas = Math.max(...elementosGerenciar.map(d=> d.coluna))
        let larguraCalculo = Math.floor(100 / secoesTamanho)
        relatar ('larguraCalculo: ' + larguraCalculo)
        //let colunasNumero = Math.max(colunas)
        relatar ('colunas', colunas)
        for (let d of secoesGerenciar){
            let rc = d?.nome == 'editar' ? 'row' : 'column'
            let coluna = criaDiv({
                id:'pulaBlocos_divGerenciar_coluna_' + d?.nome,
                ancestral:'pulaBlocos_divGerenciar_corpo',
                gap: '4px',
                rowColumn: rc
            })
            coluna.style.width = (larguraCalculo * d?.peso) + '%'
            coluna.style.maxWidth = '600px'
            for (let m of elementosGerenciar){
                if (d?.nome == m?.coluna){
                    let acao = m?.acao
                    let parametros = m?.parametros || []
                    let funcao = m?.tipo
                    let elemento = mapaFuncoesGerenciar[funcao]({
                        texto: m?.texto,
                        id: 'pulaBlocos_divGerenciar_' + m?.id,
                        ancestral: 'pulaBlocos_divGerenciar_coluna_' + m?.coluna,
                        placeholder: m?.placeholder,
                        valorInicial: m?.valorInicial,
                        opcoes: m?.opcoes,
                        acao: () => mapaFuncoesGerenciar[acao](...parametros)
                    })
                    if (m?.tipo == 'criaInput'){
                        elemento.style.height = '100%'
                        elemento.value = `Administração Geral
Administração Pública
Direito Administrativo
Fluência de dados
Raciocínio Lógico
Direito Previdenciário
Comércio Internacional
Língua Portuguesa
Direito Tributário
Língua Inglesa
Estatística
Auditoria
Contabilidade Geral
Economia e Finanças
Direito Constitucional`
                    }
                }    
            }
        }

        async function atualizaPagina(){
            window.location.reload()
        }
        
        async function salvarExcluir(acao, input) {
            let elemento = document.querySelector(input)
            let conteudo = elemento.value
            relatar(conteudo)
            let testadas = conteudo.split('\n').map(d=> d.trim()).filter(d=> /^\d+(\.\d+)*\./.test(d));
            if (testadas.length == 0){
                //rotina retorno
                return
            }
            relatar('359: ', testadas)
            let dados = await obterArmazenamento('pulaBlocos')
            let indice = dados.materias.findIndex(d=> normalizar(d.nome) == normalizar(materias?.atual)) || {}
            
            let blocos = dados.materias[indice]?.[acao] || []
            blocos.push(testadas)
            dados.materias[indice][acao] = blocos
            //blocos.push(materia.assuntos.filter(d=> d.indice.replace(/\d+\./,'') + ' ' + d.nome == materia.assunto))
            relatar ('362: ', blocos)
            await armazenar({pulaBlocos: dados})
            //let materiaAtual = estudadas.findIndex(d => d.nome == materiaAtualNome) || null
            //relatar ('362: ', materia)
            ////let blocos = []
            //for (t of testadas){
            //    relatar('362: ', t)
            //    blocos.push(materia.assuntos.filter(d=> d.indice.replace(/\d+\./,'') + ' ' + d.nome == t))
            //}
            //relatar ('362: ', blocos)
        }
    }
    //let botoes = [
    //    {
    //        id: 'pulaBlocos_botao_1',
    //        texto: '1',
    //        ancestral: 'pulaBlocos_div',
    //        cor: 'primaria',
    //        acao: alert,
    //        parametroAcao: '1'
    //    },
    //    {
    //        id: 'pulaBlocos_botao_2',
    //        texto: '2',
    //        ancestral: 'pulaBlocos_div',
    //        cor: 'primaria',
    //        acao: alert,
    //        parametroAcao: '2'
    //    },
    //    
    //]
    //let larguraCalculo = window.screen.availWidth / botoes.length
    //let largura = larguraCalculo > 250 ? '250px' : larguraCalculo + 'px'
    //relatar(largura, '', 'verde')
    //let i = 0
    //for (b of botoes){
    //    let funcao = botoes[i].acao
    //    let parametro = url[i]
    //    let botao = criaBotao({
    //        id: b?.id,
    //        texto: b?.texto,
    //        ancestral: b?.ancestral,
    //        cor: b?.cor,
    //        acao: () => funcao(parametro),
    //    })
    //    botao.style.width = largura
    //    i++
    //}
    relatar('Gran', '', 'azul')
}

iniciaGran()