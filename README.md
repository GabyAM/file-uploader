# File uploader

App for uploading, managing, and sharing files. 


## Introduction
This is a small project which purpose is to obtain experience and get comfortable with new backend technologies, such as PostgreSQL and Prisma. I was also able to refresh some concepts that i hadn't gone back to in some time, like templating engines. \
It was also built as a part of The Odin Project Node js currriculum's \
Check out the [Live preview](https://odin-file-uploader.onrender.com/)

<img width="947" alt="image" src="https://github.com/user-attachments/assets/771e9d8e-e7ae-4c81-a518-9f0bb2529f16">


## Tech Stack

Node, Express, PostgreSQL, Supabase, Prisma, Pug


## Features

- Upload your files
- Keep track of your used space
- Manage different folders
- Share folders with a link 
- Responsive design

## Installation

#### Pre-requisites

This project requires a PostgreSQL database for storing records and a supabase database for storing and downloading files. You can learn how to install PostgreSQL and create a database from [It's documentation](https://www.postgresql.org/docs/current/tutorial-install.html) or you could either host one in a PaaS like [Neon](https://neon.tech/) \
For the supabase DB, you can create one for free at https://supabase.com/ 

#### Running locally

To run this project locally, follow the steps:
1. Clone the repository to your local machine 
```
git clone https://github.com/GabyAM/odin-file-uploader
```
2. Once in the folder, install the NPM dependencies
```
npm install
```
3. Create a file named .env in the root folder
4. Insert your secret data in the .env file, this is the url for your PostgreSQL database, your supabase api url and key, and a session secret, that can be whatever you want.
```
DATABASE_URL="postgresql://username:password@localhost:5432/db_name?schema=public"
SUPABASE_API_URL="your_supabase_api_url"
SUPABASE_API_KEY="your_supabase_api_key"
SESSION_SECRET="something_secret_goes_here"
```
5. Populate the database with the prisma schema
```
npx prisma db push
```
6. Start the project in dev mode
```
npm start
```
The server will be started by default in the port 3000 of your machine. If you are already using that port, you can set the "PORT" variable in the .env file and restart it.
