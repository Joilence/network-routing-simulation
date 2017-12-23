import json
import socket

class router(object):

    # Data Members
    name = ''
    route_table = []
    threads = []
    topo_table = []
    mode = '' # 'dv' or 'ls'
    timers = []

    def __init__(self, object):
        self.name = object.name
        self.mode = object.mode
    
    # Control
    def reset_rt(self):
        pass

    def run(self):
        """
        Launch the router.
        """
        self.listen_on()

    def down(self):
        pass

    # Route Part
    def get_addr(self, dest):
        pass

    def update_rt(self, bc_pkt):
        """
        Update the route table by broadcast packet
        """
        pass
    
    # IO Part
    def send_pkt(self, addr, data):
        """
        Send packet to a router via the address

        eg:
            addr = ('127.0.0.1', 1000)
        """

        print(self.name + ': send ' + data + ' to ' + addr)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.sendto(data, addr)

    def listen_on(self):
        s = socket.socket()
        s.bind()
        pass

    # Parse
    """
    Packet Structure
    - src_addr
    - dest_addr
    - protocol: 'ls' | 'dv' | 'data'
    - msg
    """

    def decode_dgram(self, json):
        pass
    
    def encode_dgram(self, data):
        pass