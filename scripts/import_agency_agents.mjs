import fs from 'fs'
import path from 'path'

const OWNER = 'msitarzewski'
const REPO = 'agency-agents'
const BRANCH = 'main'

const apiTreeUrl = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`

function safeId(name){
  return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
}

function extractTitleAndDescription(md){
  // remove frontmatter if present
  let content = md
  if (content.startsWith('---')){
    const end = content.indexOf('\n---',3)
    if (end!==-1) content = content.slice(end+4)
  }
  const lines = content.split(/\r?\n/)
  // find first heading
  let title = ''
  for (const l of lines){
    const t = l.trim()
    if (t.startsWith('# ')) { title = t.replace('# ','').trim(); break }
    if (t.startsWith('#')) { title = t.replace(/^#+\s*/,'').trim(); break }
  }
  // first paragraph
  let para = ''
  let i = 0
  while (i < lines.length && lines[i].trim()==='') i++
  while (i < lines.length && para===''){
    const pLines = []
    while (i < lines.length && lines[i].trim() !== ''){ pLines.push(lines[i]); i++ }
    const p = pLines.join(' ').trim()
    if (p) { para = p; break }
    while (i < lines.length && lines[i].trim()==='') i++
  }
  return { title, description: para }
}

async function main(){
  console.log('Fetching repo tree...')
  const treeRes = await fetch(apiTreeUrl, { headers: { 'User-Agent': 'companyagent-importer' }})
  if (!treeRes.ok) throw new Error(`Failed to fetch tree: ${treeRes.status}`)
  const treeJson = await treeRes.json()
  const mdFiles = treeJson.tree.filter(i => i.path.endsWith('.md') && !i.path.startsWith('.github') && !i.path.startsWith('scripts') && !i.path.endsWith('README.md') && !i.path.endsWith('CONTRIBUTING.md') && !i.path.includes('i18n'))
  console.log(`Found ${mdFiles.length} markdown files`) 

  const agents = []
  for (const file of mdFiles){
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${file.path}`
    try{
      const r = await fetch(rawUrl)
      if (!r.ok) { console.warn('Failed to fetch', rawUrl); continue }
      const md = await r.text()
      const { title, description } = extractTitleAndDescription(md)
      const parts = file.path.split('/')
      const division = parts.length>1 ? parts[0] : 'general'
      const filename = parts[parts.length-1].replace(/\.md$/i,'')
      const id = safeId(filename)
      // try to extract emoji if present at start of title
      let emoji = ''
      let name = title || filename.replace(/[-_]/g,' ')
      const m = name.match(/^([\p{Emoji_Presentation}\p{Emoji}\u{1F300}-\u{1F6FF}\u{2700}-\u{27BF}]+)\s*(.*)$/u)
      if (m){ emoji = m[1]; name = m[2] }
      agents.push({
        id, name, emoji, division, description, expertise: [], deliverables: [], prompt: md.trim()
      })
    } catch (e){
      console.warn('skip', file.path, e.message)
    }
  }

  // write TS file
  const outPath = path.resolve('src','agents_all.ts')
  const header = `import type { Agent } from '../src/types'

export const AGENTS_ALL: Agent[] = `
  const body = JSON.stringify(agents, null, 2)
  fs.writeFileSync(outPath, header + body + '\n')
  console.log('Wrote', outPath, agents.length, 'agents')
}

main().catch(e=>{ console.error(e); process.exit(1) })
