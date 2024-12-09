import socket
import json
import time

def client(name):
    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client_socket.connect(("43.201.154.180", 9999))
    print(f"{name}가 서버에 연결되었습니다.")
    
    if name == "A":
        # 데이터 전송
        while True:
            input_data = input("전송할 메시지를 입력하세요: ")
            message = {
                "data": "This is a long text for testing purposes. " * 100,
                "client_sent_time": time.time()
            }
            client_socket.send(json.dumps(message).encode())
            time.sleep(1)

    elif name == "B":
        # 데이터 수신
        while True:
            data = client_socket.recv(1024)
            if not data:
                break
            
            message = json.loads(data.decode())
            client_sent_time = message.get("client_sent_time", 0)
            server_received_time = message.get("server_received_time", 0)
            client_received_time = time.time()
            
            print(f"수신 데이터: {message}")
            print(f"송신->서버->수신 소요 시간: {client_received_time - client_sent_time:.6f}초")
    
    client_socket.close()

if __name__ == "__main__":
    name = input("클라이언트 이름(A 또는 B)을 입력하세요: ")
    client(name)
