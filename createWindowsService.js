const Service = require("node-windows").Service;

const svc = new Service({
    name:"Hireflow-GCS-Backend",
    description:"A service run the Hireflow GCS backend server",
    script:"D:\\Hireflow_gcs\\HireFlow-Backend\\server.js"
});
svc.on("install",function(){
    svc.start()
});

svc.install();