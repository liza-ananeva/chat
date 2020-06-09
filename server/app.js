const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const formidable = require('formidable');
const path = require('path');

const server = http.createServer((req, res) => {
    if (req.url === '/api/upload' && req.method.toLowerCase() === 'post') {
        const form = formidable({ multiples: true, uploadDir: path.join(__dirname, 'static')});
        
        form.parse(req, (err, fields, files) => {
            if (err) throw err;
            
            if (files) {
                let fileName = fields.id + '-' + Math.floor(Date.now() / 1000) + '.jpg';
                fs.renameSync(files.file.path, path.join(__dirname, 'static', fileName));
                db.get('users').find({ id: fields.id }).assign({ photo: `http://localhost:8081/static/${fileName}`}).write();

                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Content-Type', 'application/json');
                
                return res.end(JSON.stringify({
                    id: fields.id
                }));
            }
        });
    }

    if (req.url.includes('.jpg')) {
        try {
            let file = path.join(__dirname, req.url);
            
            if (fs.existsSync(file)) {
                return res.end(fs.readFileSync(file));
            } else {
                let file = path.join(__dirname, '/static/vault_boy.jpg');
                
                if (fs.existsSync(file)) {
                    return res.end(fs.readFileSync(file));
                }
            }
        } catch (err) {
            let file = path.join(__dirname, '/static/vault_boy.jpg');
            
            if (fs.existsSync(file)) {
                return res.end(fs.readFileSync(file));
            }
        }
    }
});

const wss = new WebSocket.Server({ server });

function sendLogin(ws, user) {
    ws.id = user.id;
    ws.send(JSON.stringify({
        payload: 'login',
        data: { user }
    }));
    
    if (!db.get('online').find({ id: user.id }).value()) {
        db.get('online').push(user).write();
    }
}

function sendNewUser(wss, user) {
    wss.clients
        .forEach(client => {
            client.send(JSON.stringify({
                payload: 'newUser',
                data: { user }
            }));
        });
}

function sendOnlineUsers(ws) {
    ws.send(JSON.stringify({
        payload: 'onlineUsers',
        data: { users: db.get('online').value() }
    }));
}

function sendMessages(ws) {
    const messages = db.get('messages').value().map((message) => {
        return {
            ...message,
            user: db.get('users').find({ id: message.userId }).value()
        }
    });

    ws.send(JSON.stringify({
        payload: 'getMessages',
        data: { messages }
    }));
}

let payloads = {
    'newMessage': (data, ws) => {
        const message = {
            text: data.message.text,
            userId: ws.id,
            time: data.message.time
        }
        const user = db.get('users').find({id: message.userId}).value();
        const publicMessage = {
            ...message,
            user
        }

        db.get('messages').push(message).write();
        wss.clients
            .forEach(client => {
                client.send(JSON.stringify({
                    payload: 'newMessage',
                    data: { message: publicMessage }
                }));
            });
    },
    'newUser': (data, ws)=> {
        const findUser = db.get('users').find({ login: data.user.login }).value();

        if (findUser) {
            if (findUser.password === data.user.password) {
                sendLogin(ws,findUser);
                sendNewUser(wss,findUser);
                sendOnlineUsers(ws,findUser);
                sendMessages(ws);
            } else {
                ws.send(JSON.stringify({
                    payload: 'error',
                    data: { err: 'Неверный пароль' }
                }));
            }
        } else {
            const id = uuidv4();
            const user = {
                id,
                login: data.user.login,
                photo: 'http://localhost:8081/static/vault_boy.jpg',
                password: data.user.password
            }

            db.get('users').push(user).write();
            ws.id = id;
            
            sendLogin(ws,user);
            sendNewUser(wss,user);
            sendOnlineUsers(ws,user);
            sendMessages(ws);
        }  
    },
    'authUser': (data, ws) => {
        const findUser = db.get('users').find({ id: data.user.id }).value();

        if (findUser) {
            sendLogin(ws,findUser);
            sendNewUser(wss,findUser);
            sendOnlineUsers(ws,findUser);
            sendMessages(ws);
        } else {
            ws.send(JSON.stringify({
                payload: 'error',
                data: { err: 'Пользователь не найден' }
            }));
        }
    },
    'updatePhoto': (data) => {
        const user = db.get('users').find({ id: data.id }).value();

        wss.clients
            .forEach(client => {
                client.send(JSON.stringify({
                    payload: 'updatePhoto',
                    data: { user }
                }));
            });
    },
    'quitUser': (data) => {
        const findUser = db.get('users').find({ id: data.user.id }).value();
        
        if (findUser) {
            wss.clients
                .forEach(client => {
                    client.send(JSON.stringify({
                        payload: 'quitUser',
                        data: { user: findUser }
                    }));
                });
            db.get('online').remove({ id: findUser.id }).write();
        }
    }
}

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        let mes = JSON.parse(message);

        payloads[mes.payload](mes.data, ws);
    });
});

server.listen(8081, () => {
    console.log('Server is running on port 8081');
});