async function iniciaGran() {
    if (!location.origin.includes(PAGINAS.questoes)) return
    let cabecalho = await aguardarElemento('header')
    if (!cabecalho) return
    let divRemove = document.querySelectorAll('#pulaBlocos_div')
    for (d of divRemove){
        d.remove()
    }
    let div = criaDiv({
        id: 'pulaBlocos_div',
        ancestral: '.questoes-navbar',
        gap: '4px'
    })
    let t = 0
    let larguraCalculo = window.screen.availWidth / [Object.entries(PAGINAS.tiposDeBotoes)].length
    let largura = larguraCalculo > 185 ? '185px' : larguraCalculo + 'px'
    for (let [nomeTipo, dados] of Object.entries(PAGINAS.tiposDeBotoes)) {
        //console.log(nomeTipo, dados)
        let tipoId = 'pulaBlocos_' + nomeTipo
        let [funcao, parametros] = ['', {}]
        if (dados?.url){
            funcao = alteraTipo
            parametros = [dados?.url, nomeTipo, tipoId]
        } else if (dados?.materiaOuBloco) {
            funcao = alert
            parametros = [dados?.materiaOuBloco]
        }
        let botao = criaBotao({
            id: tipoId,
            texto: dados.texto,
            ancestral: '#pulaBlocos_div',
            cor: 'primaria',
            acao: () => funcao(...parametros),
        })
        botao.style.width = largura
        t++
    }

    async function alteraTipo(url, nomeTipo, tipoId){
        let materiasEstudadas = await obterArmazenamento('materiasEstudadas')
        let materias = await obterArmazenamento('materias')
        materiasEstudadas?.atual?.modo = nomeTipo
        
        relatar('materiasEstudadas', materiasEstudadas, 'azul')
        relatar('materias', materias, 'azul')
        relatar('url', url, 'azul')
        relatar('tipoId', tipoId, 'azul')
        //materiasEstudadas?.atual?.modo = 
        relatar('materiasEstudadas', materiasEstudadas, 'roxo')

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