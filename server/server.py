# import asyncio
# import websockets
# import RPi.GPIO as GPIO
# import time
# import random
# 
# LED_PIN = 4
# EYE_GPIO = 19
# SERVO_PIN = 18
# IN1, IN2, IN3, IN4 = 5, 6, 23, 24
# 
# GPIO.setmode(GPIO.BCM)
# GPIO.setup(LED_PIN, GPIO.OUT)
# GPIO.setup(EYE_GPIO, GPIO.OUT)
# GPIO.setup(SERVO_PIN, GPIO.OUT)
# GPIO.setup([IN1, IN2, IN3, IN4], GPIO.OUT)
# 
# eye_pwm = GPIO.PWM(EYE_GPIO, 100)
# eye_pwm.start(0)
# servo_pwm = GPIO.PWM(SERVO_PIN, 50)
# servo_pwm.start(0)
# 
# async def fade_in():
#     for duty in range(0, 101, 5):
#         eye_pwm.ChangeDutyCycle(duty)
#         await asyncio.sleep(0.05)
# 
# async def blink():
#     eye_pwm.ChangeDutyCycle(0)
#     await asyncio.sleep(0.2)
#     eye_pwm.ChangeDutyCycle(100)
#     await asyncio.sleep(0.2)
# 
# async def random_blink():
#     while True:
#         await asyncio.sleep(random.uniform(2, 10))
#         await blink()
# 
# async def set_angle(angle):
#     pulse_width = 0.5 + (angle + 90) * (2 / 180)
#     duty_cycle = (pulse_width / 20) * 100
#     servo_pwm.ChangeDutyCycle(duty_cycle)
#     await asyncio.sleep(0.5)
#     servo_pwm.ChangeDutyCycle(0)
# 
# async def move_head():
#     await set_angle(60)
#     await asyncio.sleep(1)
#     await set_angle(-60)
#     await asyncio.sleep(1)
#     await set_angle(0)
# 
# async def move_legs():
#     for _ in range(2):
#         GPIO.output([IN1, IN3], GPIO.HIGH)
#         GPIO.output([IN2, IN4], GPIO.LOW)
#         await asyncio.sleep(0.3)
#         GPIO.output([IN1, IN3, IN2, IN4], GPIO.LOW)
#         await asyncio.sleep(1)
#         GPIO.output([IN1, IN3], GPIO.LOW)
#         GPIO.output([IN2, IN4], GPIO.HIGH)
#         await asyncio.sleep(0.3)
#         GPIO.output([IN1, IN3, IN2, IN4], GPIO.LOW)
#         await asyncio.sleep(1)
# 
# async def robot_action():
#     await fade_in()
#     await asyncio.sleep(1)
#     asyncio.create_task(random_blink())
#     await move_head()
#     await move_legs()
#     GPIO.output(LED_PIN, GPIO.LOW)
# 
# async def handle_client(websocket, path):
#     async for message in websocket:
#         if message == "on":
#             GPIO.output(LED_PIN, GPIO.HIGH)
#             await robot_action()
#         elif message == "off":
#             GPIO.output(LED_PIN, GPIO.LOW)
#             eye_pwm.ChangeDutyCycle(0)
#             servo_pwm.ChangeDutyCycle(0)
#             GPIO.output([IN1, IN2, IN3, IN4], GPIO.LOW)
#         await websocket.send(f"Robot {message}")
# start_server = websockets.serve(handle_client, "0.0.0.0", 8765)
# asyncio.get_event_loop().run_until_complete(start_server)
# asyncio.get_event_loop().run_forever()








import asyncio
import websockets
import RPi.GPIO as GPIO
import time

# GPIO Pins
LED_PIN = 4
EYE_GPIO = 19
SERVO_PIN = 18
IN1, IN2, IN3, IN4 = 5, 6, 23, 24

# GPIO Setup
GPIO.setmode(GPIO.BCM)
GPIO.setup(LED_PIN, GPIO.OUT)
GPIO.setup(EYE_GPIO, GPIO.OUT)
GPIO.setup(SERVO_PIN, GPIO.OUT)
GPIO.setup([IN1, IN2, IN3, IN4], GPIO.OUT)

# PWM Setup
eye_pwm = GPIO.PWM(EYE_GPIO, 100)
eye_pwm.start(0)
servo_pwm = GPIO.PWM(SERVO_PIN, 50)
servo_pwm.start(0)

# Functions
def fade_in():
    for duty in range(0, 101, 5):
        eye_pwm.ChangeDutyCycle(duty)
        time.sleep(0.05)

def blink():
    for _ in range(2):
        eye_pwm.ChangeDutyCycle(0)
        time.sleep(0.2)
        eye_pwm.ChangeDutyCycle(100)
        time.sleep(0.2)

def set_angle(angle):
    pulse_width = 0.5 + (angle + 90) * (2 / 180)
    duty_cycle = (pulse_width / 20) * 100
    servo_pwm.ChangeDutyCycle(duty_cycle)
    time.sleep(0.5)
    servo_pwm.ChangeDutyCycle(0)

def move_legs():
    for _ in range(2):
        GPIO.output([IN1, IN3], GPIO.HIGH)
        GPIO.output([IN2, IN4], GPIO.LOW)
        time.sleep(0.3)
        GPIO.output([IN1, IN3, IN2, IN4], GPIO.LOW)
        time.sleep(1)
        GPIO.output([IN1, IN3], GPIO.LOW)
        GPIO.output([IN2, IN4], GPIO.HIGH)
        time.sleep(0.3)
        GPIO.output([IN1, IN3, IN2, IN4], GPIO.LOW)
        time.sleep(1)

async def handle_client(websocket, path):
    async for message in websocket:
        if message == "on":
            GPIO.output(LED_PIN, GPIO.HIGH)
            fade_in()
            blink()
            set_angle(60)
            time.sleep(1)
            set_angle(-60)
            time.sleep(1)
            set_angle(0)
            move_legs()
        elif message == "off":
            GPIO.output(LED_PIN, GPIO.LOW)
            eye_pwm.ChangeDutyCycle(0)
            servo_pwm.ChangeDutyCycle(0)
            GPIO.output([IN1, IN2, IN3, IN4], GPIO.LOW)
        await websocket.send(f"Robot {message}")
#WebSockets Server
start_server = websockets.serve(handle_client, "0.0.0.0", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()









#import RPi.GPIO as GPIO
# import time
# 
# # GPIO Pins
# LED_PIN = 4
# EYE_GPIO = 19
# SERVO_PIN = 18
# IN1, IN2, IN3, IN4 = 5, 6, 23, 24
# 
# # GPIO Setup
# GPIO.setmode(GPIO.BCM)
# GPIO.setup(LED_PIN, GPIO.OUT)
# GPIO.setup(EYE_GPIO, GPIO.OUT)
# GPIO.setup(SERVO_PIN, GPIO.OUT)
# GPIO.setup([IN1, IN2, IN3, IN4], GPIO.OUT)
# 
# # PWM Setup
# eye_pwm = GPIO.PWM(EYE_GPIO, 100)
# eye_pwm.start(0)
# servo_pwm = GPIO.PWM(SERVO_PIN, 50)
# servo_pwm.start(0)
# 
# # Functions
# def fade_in():
#     for duty in range(0, 101, 5):
#         eye_pwm.ChangeDutyCycle(duty)
#         time.sleep(0.05)
# 
# def blink():
#     for _ in range(2):
#         eye_pwm.ChangeDutyCycle(0)
#         time.sleep(0.2)
#         eye_pwm.ChangeDutyCycle(100)
#         time.sleep(0.2)
# 
# def set_angle(angle):
#     pulse_width = 0.5 + (angle + 90) * (2 / 180)
#     duty_cycle = (pulse_width / 20) * 100
#     servo_pwm.ChangeDutyCycle(duty_cycle)
#     time.sleep(0.5)
# 
# def move_legs():
#     for _ in range(2):
#         GPIO.output([IN1, IN3], GPIO.HIGH)
#         GPIO.output([IN2, IN4], GPIO.LOW)
#         time.sleep(0.3)
#         GPIO.output([IN1, IN3, IN2, IN4], GPIO.LOW)
#         time.sleep(1)
#         GPIO.output([IN1, IN3], GPIO.LOW)
#         GPIO.output([IN2, IN4], GPIO.HIGH)
#         time.sleep(0.3)
#         GPIO.output([IN1, IN3, IN2, IN4], GPIO.LOW)
#         time.sleep(1)
# 
# # Main Loop
# try:
#     while True:
#         command = input("Nhap lenh (on/off): ").strip().lower()
#         if command == "on":
#             GPIO.output(LED_PIN, GPIO.HIGH)
#             fade_in()
#             blink()
#             set_angle(60)
#             time.sleep(1)
#             set_angle(-60)
#             time.sleep(1)
#             set_angle(0)
#             move_legs()
#         elif command == "off":
#             GPIO.output(LED_PIN, GPIO.LOW)
#             eye_pwm.ChangeDutyCycle(0)
#             servo_pwm.ChangeDutyCycle(0)
#             GPIO.output([IN1, IN2, IN3, IN4], GPIO.LOW)
#         else:
#             print("Lenh khong hop le! Vui long nhap 'on' hoac 'off'.")
# except KeyboardInterrupt:
#     print("\nDung chuong trinh.")
# finally:
#     eye_pwm.stop()
#     servo_pwm.stop()
#     GPIO.cleanup()
#
