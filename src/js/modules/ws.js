function createWS(url, payloads, errorMessage) {
    let socket = new WebSocket(url);

    socket.onclose = function(event) {
        if (event.wasClean) {
            errorMessage('Соединение закрыто чисто');
        } else {
            errorMessage('Обрыв соединения');
        }
    }
      
    socket.onmessage = function(event) {
        let message = JSON.parse(event.data);

        payloads[message.payload](message.data, socket);
    }
      
    socket.onerror = function(error) {
        errorMessage('Ошибка ' + error.message);
    }

    return socket;
}

export {
    createWS
}