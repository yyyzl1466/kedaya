let fs = require("fs")
let request = require("request")
let prefix = process.env.QITOQITO_PREFIX || ''
let command = process.env.QITOQITO_PLATFORM
let sync = process.env.QITOQITO_SYNC
let disable = process.env.QITOQITO_DISABLE
let label = process.env.QITOQITO_LABEL || 'kedaya_'
let map = process.env.QITOQITO_MAP || ''
let cover = process.env.QITOQITO_COVER || ''
console.log(`
请先设置环境变量

QITOQITO_PLATFORM=按照所使用面板正确填写 qinglong|jtask|jd 其中一个 [青龙面板:qinglong, v3系列:jtask, 衍生面板:jd]

QITOQITO_SYNC=1 当有此变量时,面板脚本定时与仓库有效脚本定时同步

QITOQITO_DISABLE=1 当有此变量时,部分活动失效时,面板脚本定时随仓库同步禁用

QITOQITO_COVER=1 当有此变量时候,qitoCreat会强制覆盖之前生成的入口文件
        `)
if (!command) {
    return
}!(async () => {
    let change = {}
    if (map) {
        for (let k of map.replace(/\&/g,"\|").split("|")) {
            let a = k.split("=")
            for (let i of a[0].split(',')) {
                change[i] = {
                    map: a[1],
                    type: a[1].split("_")[0]
                }
            }
        }
        console.log(change)
    }
    let content = `
!(async () => {
        let prefix = process.env.QITOQITO_PREFIX ||''
        let filename = process.mainModule.filename.replace(prefix,'').match(/(\\w+)\\.js/)[1]
        let dirname = process.mainModule.path
        let type = filename.split('_')[0]
        if (['js', 'jx', 'jr', 'jw'].includes(type)) {
            type = 'jd'
        }
        let qitoqito = require(\`\${dirname}/parse/\${type}/\${filename}\`)
        let kedaya = new qitoqito()
        await kedaya.init({})
    }
)().catch((e) => {
    console.log(e.message)
})
`;
    let dicts = {};
    let dirname = process.mainModule.path
    let pathFile = fs.readdirSync(dirname);
    let common
    try {
        common = require(`${dirname}/util/common`)
    } catch (e) {}
    let msg = []
    let dir = fs.readdirSync(`${dirname}/parse`);
    dir.forEach(function(item, index) {
        let stat = fs.lstatSync(`${dirname}/parse/` + item)
        if (stat.isDirectory() === true) {
            dicts[item] = fs.readdirSync(`${dirname}/parse/${item}`)
        }
    })
    dicts['extra'] = Object.keys(change)
    console.log(`🦊 如需强制覆盖,请设置QITOQITO_COVER\n`)
    for (let i in dicts) {
        for (let j of dicts[i]) {
            let filename = `${prefix}${j}`
            if (pathFile.includes(filename) && !cover) {
                console.log(`🐹 跳过写入: ${filename} 已经在目录了`)
            } else {
                if (i == 'extra') {
                    let exc = `
!(async () => {
        let prefix = process.env.QITOQITO_PREFIX ||''
        let filename = process.mainModule.filename.replace(prefix,'').match(/(\\w+)\\.js/)[1]
        let dirname = process.mainModule.path
        let type = filename.split('_')[0]
        if (['js', 'jx', 'jr', 'jw'].includes(type)) {
            type = 'jd'
        }
        let qitoqito = require(\`\${dirname}/parse/${change[j].type}/${change[j].map}\`)
        let kedaya = new qitoqito()
        await kedaya.init({"filename":"${j}"})
    }
)().catch((e) => {
    console.log(e.message)
})
`;
                    fs.writeFile(`${dirname}/${filename}.js`, exc, function(err, data) {
                        if (err) {
                            throw err;
                        }
                        console.log(`🐯‍❄️ 写入成功: ${filename}.js 写入目录成功`)
                    })
                } else {
                    fs.writeFile(`${dirname}/${filename}`, content, function(err, data) {
                        if (err) {
                            throw err;
                        }
                        console.log(`🐯‍❄️ 写入成功: ${filename} 写入目录成功`)
                    })
                }
            }
        }
    }
    console.log(`\n🦊 正在处理定时任务\n`)
    await new Promise(e => setTimeout(e, 3000))
    if (command == 'qinglong') {
        command = 'http://127.0.0.1:5700'
    }
    if (command.includes('http')) {
        let json = fs.readFileSync('../config/auth.json', "utf-8");
        let auth = JSON.parse(json)
        let authorization = `Bearer ${auth.token}`
        let url = command;
        let cron = await curl({
            url: `${url}/api/crons?searchValue=&t=1638982538292`,
            authorization,
            'headers': {
                'Referer': `${url}/api/crons?searchValue=&t=1638982538292`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0'
            }
        })
        if (cron.code == 401) {
            let login = await curl({
                'url': `${url}/api/user/login?t=1639363615601`,
                json: {
                    "username": auth.username,
                    "password": auth.password
                },
            })
            if (login.code == 200) {
                let token = login.data.token
                authorization = `Bearer ${login.data.token}`
                cron = await curl({
                    url: `${url}/api/crons?searchValue=&t=1638982538292`,
                    authorization,
                    'headers': {
                        'Referer': `${url}/api/crons?searchValue=&t=1638982538292`,
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0'
                    }
                })
            }
        }
        if (cron.data) {
            let crontab = column(cron.data, 'command')
            for (let i in dicts) {
                for (let j of dicts[i]) {
                    if (j.includes('.js')) {
                        try {
                            let filename = `${prefix}${j}`
                            let type = j.split('_')[0]
                            if (['js', 'jx', 'jr', 'jw'].includes(type)) {
                                type = 'jd'
                            }
                            let main = require(`${dirname}/parse/${type}/${j}`)
                            let kedaya = new main()
                            if (crontab.includes(`task ${filename}`)) {
                                if (!kedaya.cron) {
                                    if (!kedaya.manual) {
                                        for (let z of cron.data) {
                                            try {
                                                if (z.name.includes(label) && z.command.includes(`task ${filename}`)) {
                                                    if (z.isDisabled) {
                                                        console.log(`🦊 禁用失败: ${filename} 已经是禁用的`)
                                                    } else {
                                                        if (disable) {
                                                            let disable = await curl({
                                                                'url': `${url}/api/crons/disable?t=1639371766925`,
                                                                json: [z._id || z.id],
                                                                authorization,
                                                                'headers': {
                                                                    'Referer': `${url}/api/crons?searchValue=&t=1638982538292`,
                                                                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0'
                                                                },
                                                                method: 'put'
                                                            })
                                                            msg.push(`🐼 禁用成功: ${filename}`)
                                                            console.log(`🐼 禁用成功: ${filename} 已经成功禁用`)
                                                        } else {
                                                            console.log(`🦊 禁用失败: ${filename} 禁用脚本失败`)
                                                        }
                                                        break
                                                    }
                                                }
                                            } catch (eee) {}
                                        }
                                    } else {
                                        console.log(`🐹 跳过操作: ${filename} 操作脚本失败,请手动运行该脚本`)
                                    }
                                } else {
                                    for (let z of cron.data) {
                                        try {
                                            if (z.name.includes(label) && z.command.includes(`task ${filename}`)) {
                                                if (z.isDisabled) {
                                                    if (sync) {
                                                        let disable = await curl({
                                                            'url': `${url}/api/crons/enable?t=1639371766925`,
                                                            json: [z._id || z.id],
                                                            authorization,
                                                            'headers': {
                                                                'Referer': `${url}/api/crons?searchValue=&t=1638982538292`,
                                                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0'
                                                            },
                                                            method: 'put'
                                                        })
                                                        msg.push(`🐽 开启成功: ${filename}`)
                                                        console.log(`🐽 开启成功: ${filename} 启用脚本成功`)
                                                    } else {
                                                        console.log(`🐽 开启失败: ${filename} 启用脚本失败`)
                                                    }
                                                }
                                                break
                                            }
                                        } catch (eee) {
                                            console.log(eee)
                                        }
                                    }
                                    console.log(`🐶 导入失败: ${filename} 已经添加过了`)
                                }
                            } else {
                                if (kedaya.cron) {
                                    let crons = typeof(kedaya.cron) == 'object' ? kedaya.cron : [kedaya.cron]
                                    for (let c of crons) {
                                        msg.push(`🦁 导入成功: ${filename}`)
                                        console.log(`🦁 导入成功: ${filename} 加入定时成功`)
                                        let add = await curl({
                                            'url': `${url}/api/crons?t=1638983187740`,
                                            json: {
                                                "command": `task ${filename}`,
                                                "name": `${label}${kedaya.title}`,
                                                "schedule": c
                                            },
                                            authorization,
                                            'headers': {
                                                'Referer': `${url}/api/crons?searchValue=&t=1638982538292`,
                                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0'
                                            }
                                        })
                                    }
                                } else {
                                    console.log(`🐯 导入跳过: ${filename} 如需运行请手动添加定时`)
                                }
                            }
                        } catch (ee) {
                            console.log(ee)
                        }
                    }
                }
            }
        } else {
            console.log("🐶 账号未登录")
        }
    } else {
        let crontab = fs.readFileSync('../config/crontab.list', "utf-8");
        let add = []
        let del = []
        var spl = crontab.split("\n");
        let cronDict = {}
        for (let i in dicts) {
            for (let j of dicts[i]) {
                try {
                    let script = `${prefix}${j.replace('.js', '')}`
                    let main = require(`${dirname}/parse/${i}/${j}`)
                    let kedaya = new main()
                    if (kedaya.cron) {
                        add.push(script)
                    } else {
                        del.push(script)
                    }
                    cronDict[script] = {
                        cron: kedaya.cron,
                        title: kedaya.title,
                        manual: kedaya.manual
                    }
                } catch (e) {
                    console.log(e)
                }
            }
        }
        for (let i in cronDict) {
            let yaya = cronDict[i]
            if (yaya.cron) {
                if (match(new RegExp(`(${command}\\s*${i})`), crontab)) {
                    for (let j in spl) {
                        if (match(new RegExp(`(${command}\\s*${i})`), spl[j])) {
                            if (spl[j][0] == '#') {
                                if (sync) {
                                    spl[j] = spl[j].replace('#', '')
                                    msg.push(`🐽 开启成功: ${i}`)
                                    console.log(`🐽 开启成功: ${i} 启用脚本成功`)
                                } else {
                                    spl[j] = spl[j]
                                    console.log(`🐽 开启失败: ${i} 启用脚本失败`)
                                }
                            }
                        }
                    }
                    console.log(`🐶 导入失败: ${i} 已经添加过了`)
                } else {
                    let crons = typeof(yaya.cron) == 'object' ? yaya.cron : [yaya.cron]
                    for (let j of crons) {
                        let b = (command == 'jtask') ? command : `bash ${command}`
                        let c = `${j} ${b} ${i}`
                        let a = (`${c}${new Array(64-c.length).join(' ')}#${label}${yaya.title}`)
                        spl.push(a)
                        msg.push(`🦁 导入成功: ${i}`)
                        console.log(`🦁 导入成功: ${i} 加入定时成功`)
                    }
                }
            } else {
                if (!yaya.manual) {
                    for (let j in spl) {
                        if (match(new RegExp(`(${command}\\s*${i})\\s*#${label}`), spl[j])) {
                            // spl[j] = ''
                            if (spl[j][0] == '#') {
                                console.log(`🦊 禁用失败: ${i} 已经是禁用的`)
                            } else {
                                if (disable) {
                                    spl[j] = `#${spl[j]}`
                                    msg.push(`🐼 禁用成功: ${i}`)
                                    console.log(`🐼 禁用成功: ${i} 已经成功禁用`)
                                } else {
                                    console.log(`🦊 禁用失败: ${i} 禁用脚本失败`)
                                }
                            }
                        }
                    }
                    if (!crontab.includes(i)) {
                        console.log(`🐯 导入跳过: ${i} 如需运行请手动添加定时`)
                    }
                } else {
                    console.log(`🐹 跳过操作: ${i} 操作脚本失败,请手动运行该脚本`)
                }
            }
        }
        spl = spl.filter(d => d)
        fs.writeFileSync('../config/crontab.list', spl.filter(d => d).join("\n"))
    }
    if (command && msg.length) {
        console.log(msg)
        let c = new common()
        for (let i in process.env) {
            c[i] = process.env[i]
        }
        c.title = `QITOQITO 任务变更`
        for (let i of msg) {
            c.notices(i)
        }
        await c.notify()
    }
})().catch((e) => {
    console.log(e)
})

function match(pattern, string) {
    pattern = (pattern instanceof Array) ? pattern : [pattern];
    for (let pat of pattern) {
        var match = pat.exec(string)
        if (match) {
            var len = match.length;
            if (len == 1) {
                return match;
            } else if (len == 2) {
                return match[1];
            } else {
                var r = [];
                for (let i = 1; i < len; i++) {
                    r.push(match[i])
                }
                return r;
            }
            break;
        }
    }
    return '';
}

function curl(params) {
    if (typeof(params) != 'object') {
        params = {
            'url': params
        }
    }
    let method = params.method || ''
    if (params.hasOwnProperty('authorization')) {
        params.headers.authorization = params.authorization
    }
    if (params.hasOwnProperty('form')) {
        params.method = 'POST'
    }
    if (params.hasOwnProperty('json')) {
        params.method = 'POST'
    }
    if (params.hasOwnProperty('body')) {
        if (typeof(params.body) == 'object') {
            params.body = JSON.stringify(params.body)
        }
        params.method = 'POST'
    }
    if (method) {
        params.method = method.toUpperCase()
    }
    return new Promise(resolve => {
        request(params, async (err, resp, data) => {
            try {
                data = JSON.parse(data)
            } catch (e) {
                // console.log(e, resp)
            } finally {
                resolve(data);
            }
        })
    })
}

function column(lists, value, key) {
    key = typeof key !== 'undefined' ? key : '';
    if (lists instanceof Array) {
        var temp = lists;
    } else {
        var temp = [];
        for (var i in lists) {
            temp.push(lists[i])
        }
    }
    if (key) {
        var data = {};
        for (var v of temp) {
            if (v[key]) {
                if (value && v.hasOwnProperty(value)) {
                    data[v[key]] = v[value]
                } else {
                    data[v[key]] = v
                }
            }
        }
        return data;
    } else {
        var data = [];
        for (var i of temp) {
            if (i[value]) {
                data.push(i[value])
            }
        }
        return data;
    }
}
