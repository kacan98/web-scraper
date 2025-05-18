## So... how do I make this run remotely/automatically?
### Database
I have a Postgress with Neon, since they have a free tier. But I also tried render but they will shut the database down after like a month - unless you pay. But yeah, just need a postgres database. Then 
``` bash
npm run update-db-with-drizzle-schema
```
has to be run to set up the tables in the db.

### Backend
I have a droplet in Digital Ocean with Ubuntu. Then on there I installed Docker with 
```bash
apt update && apt install -y docker.io
systemctl enable docker
```

I cloned this repo into the droplet. For cloning I had to get git
```bash
apt install git
```

set up SSH - by running 
```bash
ssh-keygen -t rsa -b 4096 -C
``` to generate a key then retrieve it with 
```bash
cat ~/.ssh/id_rsa.pub
```
Then adding it to GitHub in the SSH keys section. Maybe this is obvious but I just wanna document everything.

added .env file 
```bash
apt install nano
nano .env
```
with stuff line the details about the database: 
- POSTGRES_USER
- POSTGRES_PASSWORD
- POSTGRES_HOST
- POSTGRES_DB
- POSTGRES_OUTPUT_PORT
- POSTGRES_SSH_REQUIRED

and login info for IG nad LinkedIn.


Then I had to run the docker image with 
```bash
docker run --env-file .env -it --rm kcancara/scraper
```
where -it means interactive terminal and --rm means remove the container when it exits. And kcancara/scraper is the name of the image that is built and then run.

### Running the screaper
Then to run it, everything should be setu up inside of the container. So just run 
```bash
npm run start
```
to run it in the interactive mode or 
```bash
npm run scrape-jobs-remote
```
to run it with some defaults. At least that's how it was set up as I am writing this. :D Check out the package.json file for more scripts.