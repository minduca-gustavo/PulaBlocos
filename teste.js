async function teste() {
    let materiasEstudadas = await obterArmazenamento('materiasEstudadas') || {}
    let materias = await obterArmazenamento('materias') || []
    let materiaAtualNome = materiasEstudadas?.atual?.materia || ''
    //let materiaAtualObject = materias.find(d => d.nome == materiaAtualNome) || {}
    //let materiaAtualId = materiaAtualObject?.id || ''
    let materiaAtualIndex = materias.findIndex(d => d.nome == materiaAtualNome) || {}
    relatar(materiaAtualIndex)
    let materiaAtualId = materias?.[materiaAtualIndex]?.id || ''
    let blocoAtualNome = materiasEstudadas?.atual?.bloco || ''
    let blocoAtualObject = materias?.[materiaAtualIndex]?.assuntos.find(d => d?.indice.replace(/^\d+\./, "") + ' ' + d?.nome == blocoAtualNome) || {}
    //relatar(materiaAtualObject?.assuntos[246].indice.replace(/^\d+\./, "") + ' ' + materiaAtualObject?.assuntos[246].nome)
    let blocoAtualId = blocoAtualObject?.id || ''
    relatar('materiaAtualId 7: ',materiaAtualId, 'azul')
    relatar('blocoAtualId 7: ',blocoAtualId, 'azul')
    let testarGit = await bFetch('https://minduca-gustavo.github.io/PulaBlocos/materias.json')
    relatar ('testarGit', testarGit, 'vermelho')
    //await atualizaBlocos()
}
//atualizaBlocos()
teste()