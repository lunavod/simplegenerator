#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const prompt = require('prompt-sync')()

const args = process.argv.slice(2)
const debug = false

console.debug = (...arg) => {
    if (!debug) return
    console.log(...arg)
}

console.debug(args)

function test(command_args, standalone=false) {
    if (standalone) console.debug(command_args)
    console.log('Hmmm, what do we have here...')

    if (!fs.existsSync('.sg_templates')) {
        console.log(chalk.red('Oh man. You do not have a .sg_templates Directory in this path!'))
        console.log(chalk.yellow(`.sg_templates - Directory where all templates live. Maybe you named it wrong, using me in wrong path or just forgot to create it.`))
        return false
    }

    if (!fs.existsSync(`.sg_templates/${command_args[0]}`)) {
        console.log(chalk.red(`I'm sorry, Dave, I can't do it. There is no template for ${command_args[0]}. (`))
        console.log(chalk.yellow(`Each template needs its own cozy Directory in .sg_templates!`))
        return false
    }

    if (!fs.existsSync(`.sg_templates/${command_args[0]}/.sg.json`)) {
        console.log(chalk.red(`Oh-oh. There is a template Directory for ${command_args[0]}, but I can't find there any sg config file!`))
        console.log(chalk.yellow(`.sg.json - JSON file in template Directory from which I can learn basic things about template.`))
        return false
    }

    let config = {}
    try {
        config = JSON.parse(fs.readFileSync(`.sg_templates/${command_args[0]}/.sg.json`).toString())
    } catch(e) {
        console.debug(e)
        console.log(chalk.red(`Looks like your config file for ${command_args[0]} is not in JSON, I can't read it...`))
        return false
    }

    const requiredProperties = {
        path: {
            description: `From 'path' property, I can understand where I should generate the ${command_args[0]}.`,
            check: () => {
                if (!fs.existsSync(config.path)) {
                    console.log(chalk.red(`path property check failed. There is no such path!`))
                    return false
                }
                return true
            }
        }
    }
    const requiredPropertiesNames = Object.keys(requiredProperties)

    for (let i=0; i<requiredPropertiesNames.length; i++) {
        let name = requiredPropertiesNames[0]
        let prop = requiredProperties[name]
        if (!(name in config)) {
            console.log(chalk.red(`Ow. There is no '${name}' property in config...`))
            console.log(chalk.yellow(prop.description))
            return false
        }
        if (!prop.check()) {
            console.log(chalk.yellow(prop.description))
            return false
        }
    }

    if (standalone) console.log(chalk.green(`Yay, everything is awesome!`))

    return true
}

function generate(command_args, standalone=false) {
    if (standalone) console.debug(command_args)
    if (!test(command_args)) {
        console.log('Ooooops, something went wrong. Fix it and try again! I\'ll be waiting for you. ^^')
        return false
    }
    console.log(chalk.green(`Oh yeah, all set. Lets generate a ${command_args[0]}!`))

    const config = JSON.parse(fs.readFileSync(`.sg_templates/${command_args[0]}/.sg.json`).toString())
    console.debug(config)

    const params = command_args.slice(1)
    const data = {}
    if (config.defaultValues) {
        Object.keys(config.defaultValues).forEach(name=>{
            data[name] = {value: config.defaultValues[name]}
        })
    }
    params.forEach(val=>{
        let splitted = val.split(':')
        data[splitted[0].toLowerCase()] = {
            value: splitted[1]
        }
    })

    function process(s) {
        function processIf(s) {
            while (s.match(/##SG:IF\((.+?)\)##/g)) {
                let ifStart = s.match(/##SG:IF\((.+?)\)##/g)[0]
                let name = ifStart.replace(/##SG:IF\((.+?)\)##/g, (_, name)=>name)
                s = s.replace(RegExp(`##SG:IF\\(${name}\\)##([.\\s\\S]+?)\n?##SG:ENDIF\\(${name}\\)##`), (_, content)=>{
                    if (!(name.toLowerCase() in data)) return ''
                    let val = data[name.toLowerCase()].value
                    return val !== '0' && val !== 'false' ? content : ''
                })
            }
            return s
        }
        s = processIf(s)
        s = s.replace(/##SG:(.+?)##/g, (_, name)=>{
            if (!(name.toLowerCase() in data)) throw(`Oops, looks like you forgot to provide a value for '${name.toLowerCase()}'`)
            return data[name.toLowerCase()].value
        })
        return s
    }

    function walk(dir, filelist = []) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const dirFile = path.join(dir, file);
            const dirent = fs.statSync(dirFile);
            if (dirent.isDirectory()) {
                var odir = {
                    path: dirFile,
                    new_path: process(dirFile.replace(`.sg_templates/${command_args[0]}/`, config.path)),
                    type: 'directory',
                    files: []
                }
                odir.files = walk(dirFile, dir.files);
                filelist.push(odir);
            } else {
                if (!path.basename(dirFile).startsWith('.sg')) {
                    let newPath = process(dirFile.replace(`.sg_templates/${command_args[0]}/`, config.path))
                    if (newPath.endsWith('.sg')) newPath = newPath.slice(0, newPath.length-3)
                    filelist.push({
                        path: dirFile,
                        new_path: newPath,
                        type: 'file'
                    });
                }
            }
        }
        return filelist;
    }

    let files_tree = []

    try {
        files_tree = walk(`.sg_templates/${command_args[0]}/`)
    } catch(e) {
        console.log(chalk.red(e))
        return
    }

    function create(tree) {
        for (const file of tree) {
            console.debug(file)
            if (file.type === 'directory') {
                fs.mkdirSync(file.new_path)
                console.log(chalk.cyan(`Created ${file.new_path}`))
                create(file.files)
            } else if (file.type === 'file') {
                let content = fs.readFileSync(file.path).toString()
                if (file.path.endsWith('.sg')) {
                    content = process(content)
                }
                fs.writeFileSync(file.new_path, content)
                console.log(chalk.cyan(`Created ${file.new_path}`))
            }
        }
    }

    console.debug(files_tree)

    try {
        create(files_tree)
        console.log(chalk.green(`All done! Enjoy your new ${command_args[0]}`))
    } catch(e) {
        if (e.toString().startsWith('Error: EEXIST:')) {
            console.log(chalk.red(`Directory ${e.toString().replace('Error: EEXIST: file already exists, mkdir ', '')} already exists `))
            return false
        }
        console.log(chalk.red(e))
        return false
    }
}

function initTemplate(command_args) {
    if (!fs.existsSync('.sg_templates')) {
        console.log(`I didn't found a '.sg_templates' directory here. Would you like me to create it?`)
        let a = prompt(`Create it? (yes) `)
        if (a !== 'y' && a !== 'yes' && a !== '') {
            return false
        }
        fs.mkdirSync('.sg_templates')
        console.log(chalk.cyan(`Yay, '.sg_templates' directory created`))
    }
    function questionName() {
        let a = prompt('So, how to name this template? ')
        if (!a) {
            console.log(chalk.red(`Sorry, i can't create directory with empty name (`))
            return questionName()
        }
        if (fs.existsSync('.sg_templates/'+a)) {
            console.log(chalk.red(`Oh, but you already have template with that name...`))
            return questionName()
        }
        return a
    }
    let name = command_args[0]
    if (!name) name = questionName()
    if (fs.existsSync('.sg_templates/'+name)) {
        console.log(chalk.red(`Template ${name} already exists! D:`))
        name = questionName()
    }
    fs.mkdirSync(`.sg_templates/${name}`)
    console.log(chalk.cyan(`.sg_templates/${name} created!`))
    function questionTemplatePath() {
        let a = prompt('In which folder should I put the generation results from this template? ')
        if (!a) {
            a = prompt(`Are you sure? This field is required, so if you leave this empty generation will not work. (no) `)
            if (a==='no'||a==='n'||a==='')
                return questionTemplatePath()
        }
        return a
    }
    let templatePath = command_args[1]
    if (!templatePath) templatePath = questionTemplatePath()
    fs.writeFileSync(`.sg_templates/${name}/.sg.json`, `{ "path": "${templatePath}" }`)
    console.log(chalk.cyan(`.sg_templates/${name}/.sg.json created!`))
    console.log(chalk.green(command_args.length?`
Your template is ready now! But it's empty. 
You should put some directories and files in it.`
        :
`
Your template is ready now! But it's empty. 
You should put some directories and files in it.
You can use SG syntax in any filenames and inside files with *.sg extensions. (After generation extension will be deleted, so 'test.js.sg' will become just 'test.js')
SG syntax:
1) ##SG:VARIABLENAME##
    This will simply be replaced by the value of the variable during generation.
2) ##SG:IF(VARIABLENAME)##...##SG:ENDIF(VARIABLENAME)##
    It's simple. If at generation there will be a variable with the same name, the content in the condition will be written to the file. If not ... Well, you understand.
    WARN: No else, no logic. Just simplest if.
And, by the way, variable names are not case sensitive. Like, at all.

To generate from this template, just enter 
sg generate ${name}

To pass variable with value use 'variable_name:variable_value', like 'sg generate ${name} testvar:helloworld'
To pass variable without value (you should only use it for IF, otherwise instead of variable value it will be 'undefined') use 'variable_name', like 'sg generate ${name} testvar'`))
}

const commands = {
    generate: generate,
    test: test,
    initTemplate: initTemplate
}

function main() {
    if (!args.length) {
        console.log(chalk.red('Looks like you forgot to enter command!'))
        return false
    }
    if (Object.keys(commands).indexOf(args[0])<0) {
        console.log(chalk.red(`Sorry, i don't know how to ${args[0]} T_T`))
        console.log()
        console.log('But i know other commands, maybe you meant one of them?')
        console.log(Object.keys(commands).join(', '))
        return false
    }
    commands[args[0]](args.slice(1), true)
}

main()