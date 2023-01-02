/**
 * @author Cameron McKay
 * 
 * @email cameron@webnx.com
 * 
 * @brief Basic driver file for starting the app and opening API_PORT for requests
 * 
 */

// import basic requirements
import http from 'http'
import app from './app.js'
import config from './config.js';
import handleError from './config/mailer.js';

// Hand off requests to app
const server = http.createServer(app);

// Get port
const port = config.PORT;

// Open API_PORT for listening
server.listen(port, () => {
    console.log("\x1b[32m", "\x1b[1m",`                          
    ▄█     █▄     ▄████████ ▀█████████▄  ███▄▄▄▄   ▀████    ▐████▀ 
    ███     ███   ███    ███   ███    ███ ███▀▀▀██▄   ███▌   ████▀  
    ███     ███   ███    █▀    ███    ███ ███   ███    ███  ▐███    
    ███     ███  ▄███▄▄▄      ▄███▄▄▄██▀  ███   ███    ▀███▄███▀    
    ███     ███ ▀▀███▀▀▀     ▀▀███▀▀▀██▄  ███   ███    ████▀██▄     
    ███     ███   ███    █▄    ███    ██▄ ███   ███   ▐███  ▀███    
    ███ ▄█▄ ███   ███    ███   ███    ███ ███   ███  ▄███     ███▄  
     ▀███▀███▀    ██████████ ▄█████████▀   ▀█   █▀  ████       ███▄ 
                                            
                   ▄████████    ▄███████▄  ▄█   
                  ███    ███   ███    ███ ███   
                  ███    ███   ███    ███ ███▌ 
                  ███    ███   ███    ███ ███▌
                ▀███████████ ▀█████████▀  ███▌              
                  ███    ███   ███        ███     
                  ███    ███   ███        ███     
                  ███    █▀   ▄████▀      █▀   

WebNX API by Cameron McKay`,"\x1b[36m",`\nNow with Typescript!`,
"\x1b[0m",`\nServer running on port ${config.PORT}`);
});






































//   ▄█     █▄     ▄████████ ▀█████████▄  ███▄▄▄▄   ▀████    ▐████▀ 
//  ███     ███   ███    ███   ███    ███ ███▀▀▀██▄   ███▌   ████▀  
//  ███     ███   ███    █▀    ███    ███ ███   ███    ███  ▐███    
//  ███     ███  ▄███▄▄▄      ▄███▄▄▄██▀  ███   ███    ▀███▄███▀    
//  ███     ███ ▀▀███▀▀▀     ▀▀███▀▀▀██▄  ███   ███    ████▀██▄     
//  ███     ███   ███    █▄    ███    ██▄ ███   ███   ▐███  ▀███    
//  ███ ▄█▄ ███   ███    ███   ███    ███ ███   ███  ▄███     ███▄  
//   ▀███▀███▀    ██████████ ▄█████████▀   ▀█   █▀  ████       ███▄ 
                                                                     
//         ▄████████    ▄███████▄  ▄█                                   
//        ███    ███   ███    ███ ███                                   
//        ███    ███   ███    ███ ███▌                                  
//        ███    ███   ███    ███ ███▌      ██████      ██████          
//      ▀███████████ ▀█████████▀  ███▌           ██    ██  ████              
//        ███    ███   ███        ███        █████     ██ ██ ██                
//        ███    ███   ███        ███       ██         ████  ██             
//        ███    █▀   ▄████▀      █▀        ███████ ██  ██████  
