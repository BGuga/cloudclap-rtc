import socket
import threading
import json
import time  # 추가된 부분

def handle_client(client_socket, other_client_socket, client_name):
    while True:
        try:
            # 데이터 수신
            data = client_socket.recv(1024)
            if not data:
                break
            
            # 시간 측정을 위한 타임스탬프 포함
            message = json.loads(data.decode())
            message["server_received_time"] = time.time()

            print(f"{client_name}로부터 받은 데이터: {message}")

            # 데이터를 다른 클라이언트로 전송
            if other_client_socket:
                other_client_socket.send(json.dumps(message).encode())

        except Exception as e:
            print(f"{client_name} 처리 중 오류: {e}")
            break
    
    client_socket.close()

def server():
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind(("127.0.0.1", 9999))
    server_socket.listen(2)
    print("서버가 시작되었습니다.")
    
    client_sockets = []

    while len(client_sockets) < 2:
        client_socket, addr = server_socket.accept()
        print(f"클라이언트 접속: {addr}")
        client_sockets.append(client_socket)

    # A와 B 간의 송수신 처리
    thread_a = threading.Thread(target=handle_client, args=(client_sockets[0], client_sockets[1], "A"))
    thread_b = threading.Thread(target=handle_client, args=(client_sockets[1], client_sockets[0], "B"))
    thread_a.start()
    thread_b.start()

if __name__ == "__main__":
    server()
