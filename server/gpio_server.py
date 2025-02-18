import asyncio
import websockets
import RPi.GPIO as GPIO

LED_PIN = 4
GPIO.setmode(GPIO.BCM)
GPIO.setup(LED_PIN, GPIO.OUT)

async def handle_client(websocket, path):
    async for message in websocket:
        if message == "on":
            GPIO.output(LED_PIN, GPIO.HIGH)
        elif message == "off":
            GPIO.output(LED_PIN, GPIO.LOW)
        await websocket.send(f"LED {message}")

start_server = websockets.serve(handle_client, "0.0.0.0", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
