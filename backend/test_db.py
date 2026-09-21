from database import engine

try:
    with engine.connect() as connection:
        print("SUCCESS: Connected to MySQL database!")
except Exception as e:
    print("ERROR: Could not connect to MySQL")
    print(e)