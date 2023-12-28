# Minimalist file uploader

#### Very simple and easy to setup file uploader written as a school project.

It supports multiple users with their own quotas, sharing files publicly as well as anonymous uploads using tokens.

### Running

```shell
UPLOADS_PATH=./uploads docker-compose up --build
```

Access web interface via [localhost:43325](http://localhost:43325).

###### By default there is a single `root` user with `root` password. Sign in, change its password and create your own user.
