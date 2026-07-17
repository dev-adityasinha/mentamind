
# Docker Workflow
- Since the project relies on Docker without host volume mounts for the codebase, **ALWAYS rebuild** the containers (docker compose up -d --build <service>) after making any code modifications. Do not just estart the containers.
