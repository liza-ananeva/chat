import '../assets/sass/style.scss';
import { createWS } from './modules/ws';
import dialog from '../views/dialog.hbs';
import peer from '../views/peer.hbs';

//Функционал пароля
const hash = require('object-hash');

//Сообщение об ошибке
const errMsg = document.querySelector('.error-message');

//Окно авторизации
const auth = document.querySelector('.auth-wrapper');
const authForm = document.querySelector('.auth-form');
const username = document.querySelector('#username');
const password = document.querySelector('#password');

//Окно чата
const chat = document.querySelector('.chat-wrapper');
const dialogsList = document.querySelector('.dialogs__list');
const historyContainer = document.querySelector('.history');
const historyPeers = document.querySelector('.history__peers');

//Гамбургер-меню
const hamburger = document.querySelector('.hamburger-menu');

//Счетчик числа активных участников чата
const userOnlineCount = document.querySelector('.conversation__participants');

//Отправка сообщений
const sendMessageForm = document.querySelector('.send-message__form');
const sendMessageField = document.querySelector('#send-message-field');

//Окно, предлагающее загрузить аватар
const uploadDialog = document.querySelector('.upload-dialog-wrapper');
const uploadDialogClose = document.querySelector('.upload-dialog__close');
const uploadDialogPicture = document.querySelector('.upload-dialog__picture');
const uploadDialogPic = document.querySelector('.upload-dialog__pic');

//Окно выбора и загрузки аватара
const upload = document.querySelector('.upload-wrapper');
const uploadForm = document.querySelector('.upload__form');
const uploadNewPhoto = document.querySelector('.upload__form-pic');
const uploadFile = document.querySelector('#upload');
const cancelBtn = document.querySelector('.btn--cancel');

//Функции показать/скрыть окно
function show(what) {
    if (!what.className.includes('--active')) {
        what.classList.add(`${what.classList}--active`);
    }
}

function hide(what) {
    if (what.className.includes('--active')) {
        for (let i = 0; i < what.classList.length; i++) {
            if (what.classList[i].includes('--active')) {
                what.classList.remove(`${what.classList[i]}`);
            }
        }
    }
}

//Функция вывода сообщения об ошибке
function errorMessage(message) {
    errMsg.innerText = message;
}

//Обработчики различных кнопок
hamburger.addEventListener('click', (event) => {
    show(uploadDialog);
});

uploadDialogClose.addEventListener('click', (event) => {
    hide(uploadDialog);
});

uploadDialogPicture.addEventListener('click', (event) => {
    show(upload);
});

cancelBtn.addEventListener('click', (event) => {
    hide(upload);
});

//Preview аватара пользователя
uploadFile.addEventListener('change', (event) => {
    let file = event.target.files[0];
    
    if (!file.type == 'image/jpeg') {
        alert('jpg only');
    } else {
        let reader = new FileReader();
        
        reader.onloadend = () => {
            uploadNewPhoto.src = reader.result;
        }
        reader.readAsDataURL(file);
    }
});

//Функция возвращает id текущего пользователя из localStorage
function getUserId() {
    return localStorage.getItem('id');
}

//Проверяем, присутствует ли данный пользователь в списке online пользоватей
function checkUserList(userId) {
    for (let i = 0; i < dialogsList.children.length; i++) {
        let user = dialogsList.children[i];
        
        if (user.getAttribute('data-user') == userId) {
            return true;
        }
    }

    return false;
}

let ws = createWS('ws://localhost:8081', {
    'newMessage': (data) => {
        let list = historyPeers.lastElementChild;
        let lastUser = true;
        
        if (list !== null && list.hasAttribute('data-user')) {
            lastUser = !(data.message.userId == list.getAttribute('data-user'));
        }
        
        data.message.currentUser = (getUserId() == data.message.userId);
        data.message.lastUser = lastUser;
        
        historyPeers.innerHTML += peer(data.message);
        //Автоматический скролл вниз
        historyContainer.scrollTop = historyContainer.scrollHeight;
    },
    'getMessages': (data) => {
        data.messages
            .forEach(message => {
                let list = historyPeers.lastElementChild;
                let lastUser = true;
                
                if (list !== null && list.hasAttribute('data-user')) {
                    lastUser = !(message.userId == list.getAttribute('data-user'));
                }

                message.currentUser = (getUserId() == message.userId);
                message.lastUser = lastUser;
                
                historyPeers.innerHTML += peer(message);
                //Автоматический скролл вниз
                historyContainer.scrollTop = historyContainer.scrollHeight;
            });
    },
    'onlineUsers': (data) => {
        if (data.users) {
            data.users
                .forEach(user => {
                    if (!checkUserList(user.id)) {
                        dialogsList.innerHTML += dialog({ user: user });
                    }
                });
        }
        
        userOnlineCount.innerText = `Активных участников: ${dialogsList.children.length}`;
    },
    'error': (data) => {
        errorMessage(data.err);
        show(auth);
        hide(chat);
    },
    'login': (data) => {
        localStorage.setItem('id', data.user.id);
        document.querySelector('.upload-dialog__username').innerText = data.user.login;
        
        uploadDialogPic.src = data.user.photo;
        uploadNewPhoto.src = data.user.photo;

        errMsg.innerText = '';
        
        show(chat);
        hide(auth);
    },
    'newUser': (data) => {
        if (!checkUserList(data.user.id)) {
            dialogsList.innerHTML += dialog(data);
        }

        userOnlineCount.innerText = `Активных участников: ${dialogsList.children.length}`;
    },
    'updatePhoto': (data) => {
        document.querySelectorAll(`[data-user='${data.user.id}']`)
            .forEach(user => {
                if (user.querySelector('.history__photo') !== null) {
                    user.querySelector('.history__photo').src = data.user.photo;
                }
                if (user.querySelector('.dialog__photo') !== null) {
                    user.querySelector('.dialog__photo').src = data.user.photo;
                }
            });
    },
    'quitUser': (data) => {
        for (let i = 0; i < dialogsList.children.length; i++) {
            let user = dialogsList.children[i];
            
            if (user.getAttribute('data-user') == data.user.id) {
                dialogsList.removeChild(user);
            }
        }
        
        userOnlineCount.innerText = `Активных участников: ${dialogsList.children.length}`;
    }
}, errorMessage);

//Функция проверяет, заходил ли пользователь ранее на сайт
function isLocalStorageEmpty(ws) {
    let data = localStorage.getItem('id');

    if (data === null) {
        show(auth);
    } else {
        ws.send(JSON.stringify({
            payload: 'authUser',
            data: {
                user: {
                    id: data
                }
            }
        }));
    }
}

ws.onopen = function() {
    isLocalStorageEmpty(ws);

    authForm.addEventListener('submit', function (event) {
        event.preventDefault();

        if (username.value.trim() != '' && password.value.trim() != '') {
            ws.send(JSON.stringify({
                payload: 'newUser',
                    data: {
                        user: {
                            login: username.value,
                            password: hash(password.value)
                        }
                    }
            }));
        } else {
            errorMessage('Поля обязательны для заполнения');
        }
        
        return false;
    });

    sendMessageForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (sendMessageField.value.trim() != '') {
            ws.send(JSON.stringify({
                payload: 'newMessage',
                data: {
                    message: {
                        userId: getUserId(),
                        text: sendMessageField.value,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                }
            }));
            sendMessageField.value = '';
        }

        return false;
    });
    
    window.onbeforeunload = function() {
        ws.send(JSON.stringify({
            payload: 'quitUser',
            data: {
                user:{
                    id: getUserId()
                }
            }
        }));
    }
    
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(uploadForm);

        formData.append('id', localStorage.getItem('id'));
        formData.append('file',uploadFile.files[0]);

        const response = await fetch('http://localhost:8081/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.id) {
            ws.send(JSON.stringify({
                payload: 'updatePhoto',
                data: {
                    id: data.id
                }
            }));

            uploadDialogPic.src = uploadNewPhoto.src;
        }
        
        hide(upload);
    });
    
    return false;
};