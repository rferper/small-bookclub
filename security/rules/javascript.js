// ruleid: javascript-dynamic-execution
eval('fictional')
// ruleid: javascript-dynamic-execution
new Function('fictional')
// ruleid: javascript-shell-execution
child.exec('fictional')
// ruleid: javascript-shell-execution
child.execSync('fictional')
// ruleid: javascript-shell-execution
spawn('fictional', [], { shell: true })
// ok: javascript-shell-execution
spawn('fictional', [], { shell: false })
// ruleid: react-html-injection
const unsafe = <div dangerouslySetInnerHTML={{ __html: 'fictional' }} />
// ok: react-html-injection
const safe = <div>{'fictional'}</div>
