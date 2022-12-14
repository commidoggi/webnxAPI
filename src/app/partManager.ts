
/**
 * @author Cameron McKay
 * 
 * @email cameron@webnx.com
 * 
 * @brief Part manager object for querying database and creating responses
 * 
 */
import Part from '../model/part.js'
import PartRecord from '../model/partRecord.js'
import Asset from '../model/asset.js'
import User from "../model/user.js";
import handleError from "../config/mailer.js";
import callbackHandler from '../middleware/callbackHandlers.js'
import { AssetSchema, PartRecordSchema } from "./interfaces.js";
import { CallbackError, Mongoose } from "mongoose";
import { Request, Response } from "express";
import { MongooseError } from "mongoose";
import { PartSchema } from "./interfaces.js";

const partManager = {
    // Create
    createPart: async (req: Request, res: Response) => {
        try {
            // Get part info from request body
            const { nxid, manufacturer, name, type, quantity } = req.body.part;
            // If any part info is missing, return invalid request
            if (!(nxid&&manufacturer&&name&&type)) {
                return res.status(400).send("Invalid request");
            }
            if (!/PNX([0-9]{7})+/.test(nxid)) {
                return res.status(400).send("Invalid part ID");
            }
            // Try to add part to database
            /**
             * @TODO Add part validation logic
             */
            // Send part to database
            req.body.part.created_by = req.user.user_id;
            await Part.create(req.body.part, (err: MongooseError, part: PartSchema) => {
                if (err) {
                    // Return and send error to client side for prompt
                    return res.status(500).send("API could not handle your request: " + err);
                }
                for (let i = 0; i < quantity; i++) {
                    // Create part records to match the quantity and location of the part schema creation
                    PartRecord.create({
                        nxid: part.nxid,
                        building: req.body.building ? req.body.building : req.user.building,/*req.user.building,*/
                        location: req.body.location ? req.body.location : "Parts Room",
                        by: req.user.user_id
                    }, callbackHandler.callbackHandleError)
                }
                // Succesful query
                return res.status(200).send(`Created part: ${part.manufacturer} ${part.name}`);

            });
        } catch (err) {
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    },
    // Read
    getPart: async (req: Request, res: Response) => {
        try {
            // Destructure request
            const { location, building } = req.query;
            const req_part = req.query.part as PartSchema;
            // Find parts that match request
            Part.find(req_part, async (err: CallbackError | null, parts: PartSchema[]) => {
                if (err) {
                    // Database err
                    handleError(err)
                    return res.status(500).send("API could not handle your request: " + err);
                }
                Promise.all(parts.map((part)=>{
                    return new Promise(async (resolve, reject) => {
                        let count = await PartRecord.count({
                            nxid: part.nxid,
                            next: null,
                            location: location ? location : "Parts Room",
                            building: building ? building : req.user.building
                        });
                        let total_count = await PartRecord.count({
                            nxid: part.nxid,
                            next: null
                        });
                        let tempPart = JSON.parse(JSON.stringify(part))
                        
                        tempPart.quantity = count;
                        tempPart.total_quantity = total_count;
                        return resolve(tempPart)
                    })
                })).then((returnParts)=>{
                    return res.status(200).json(returnParts);
                })
            })
        } catch (err) {
            // Database error
            handleError(err)
            res.status(500).send("API could not handle your request: " + err);
        }
    },
    getPartByID: async (req: Request, res: Response) => {
        try {
            let part = {} as PartSchema
            // Check if NXID
            if (/PNX([0-9]{7})+/.test(req.query.id as string)) {
                part = await Part.findOne({ nxid: { $eq: req.query.id } }) as PartSchema;
            }
            // If mongo ID
            else {
                part = await Part.findById(req.query.id) as PartSchema
            }
            // Get the total quantity
            let total_quantity = await PartRecord.count({
                nxid: part.nxid,
                next: null
            });
            // Get available quantity in specified building or location - use defaults from ternary if unspecified
            let quantity = await PartRecord.count({
                nxid: part.nxid,
                building: req.query.building ? req.query.building : req.user.building,
                location: req.query.location ? req.query.location : "Parts Room",
                next: null
            });
            part = part._doc;
            part.total_quantity = total_quantity;
            part.quantity = quantity;
            res.status(200).json(part);
        } catch (err) {
            // Database error
            handleError(err)
            res.status(500).send("API could not handle your request: " + err);
        }
    },
    checkout: async (req: Request, res: Response) => {
        try {
            let { user_id, cart } = req.body
            if(user_id!='all') {
                let user = await User.findById(user_id).exec()
                if(user_id==null||user_id==undefined||user==null)
                    return res.status(400).send("Invalid request")
            }
            // Find each item and check quantities before updating
            for (let item of cart) {
                // Check quantity before
                let quantity = await PartRecord.count({
                    nxid: item.nxid,
                    location: "Parts Room",
                    building: item.building,
                    next: null
                });
                // Insufficient stock
                if (quantity < item.quantity) {
                    return res.status(400).send("Insufficient stock.")
                }
            }
            // Loop through each item and create new parts record and update old parts record
            for (let item of cart) {
                // Find all matching part records to minimize requests and ensure updates don't conflict when using async part updating
                let records = await PartRecord.find({
                    nxid: item.nxid,
                    location: "Parts Room",
                    building: item.building,
                    next: null
                });
                // Loop for quanity of part item
                for (let j = 0; j < item.quantity; j++) {
                    // Create new iteration
                    PartRecord.create({
                        nxid: item.nxid,
                        owner: user_id,
                        location: "Tech Inventory",
                        building: item.building,
                        by: req.user.user_id,
                        prev: records[j]._id,
                        next: null
                    }, callbackHandler.updateRecord);
                }
            }
            // Success
            res.status(200).send("Successfully checked out.")
        }
        catch (err) {
            // Error
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    },
    checkin: async (req: Request, res: Response) => {
        try {
            let { user_id, inventory } = req.body
            // Make sure user is valid of 'all' as in
            // All Techs
            if(user_id!='all') {
                let user = await User.findById(user_id).exec()
                if(user_id==null||user_id==undefined||user==null)
                    return res.status(400).send("Invalid request")
            }
            // Check quantities before updating records
            for (let item of inventory) {
                let quantity = await PartRecord.count({
                    nxid: item.nxid,
                    next: null,
                    owner: user_id
                })
                // If check in quantity is greater than 
                // inventory quantity
                if (item.quantity > quantity) {
                    return res.status(400).send("Invalid request")
                }
            }
            // Iterate through each item and update records
            for (let item of inventory) {
                // Get database quantity
                const records = await PartRecord.find({
                    nxid: item.nxid,
                    next: null,
                    owner: user_id
                });
                // Loop through the quantity of the item and 
                // change records
                for (let i = 0; i < item.quantity; i++) {
                    // Create new part record - set prev to old record
                    await PartRecord.create({
                        nxid: item.nxid,
                        next: null,
                        prev: records[i]._id,
                        location: "Parts Room",
                        building: req.user.building,
                        by: req.user.user_id
                    }, callbackHandler.updateRecord);
                }
            }
            // Success
            res.status(200).send("Successfully checked in.")
        }
        catch (err) {
            // Error
            handleError(err)
            res.status(500).send("API could not handle your request: " + err);
        }
    },
    searchParts: async (req: Request, res: Response) => {
        try {
            // Search data
            // Limit
            // Page number
            const { searchString, pageSize, pageNum, building, location } = req.query;
            // Find parts
            // Skip - gets requested page number
            // Limit - returns only enough elements to fill page

            // Splice keywords from search string
            let i = 0
            let keywords = []
            let spliced = false
            if(typeof(searchString)!="string") {
                return res.status(400).send("Search string undefined");
            }
            while (!spliced) {
                // If end of string
                if (searchString.indexOf(" ", i) == -1) {
                    keywords.push(searchString.substring(i, searchString.length))
                    spliced = true
                } else {
                    // Add spliced keyword to keyword array
                    keywords.push(searchString.substring(i, searchString.indexOf(" ", i)))
                    i = searchString.indexOf(" ", i) + 1
                }
            }
            // Use keywords to build search options
            let searchOptions = [] as any
            // Add regex of keywords to all search options
            await Promise.all(keywords.map(async (key) => {
                return new Promise((resolve, reject) => {
                    searchOptions.push({ "nxid": { $regex: key, $options: "is" } })
                    searchOptions.push({ "name": { $regex: key, $options: "is" } })
                    searchOptions.push({ "manufacturer": { $regex: key, $options: "is" } })
                    searchOptions.push({ "type": { $regex: key, $options: "is" } })
                    searchOptions.push({ "location": { $regex: key, $options: "is" } })
                    searchOptions.push({ "storage_interface": { $regex: key, $options: "is" } })
                    searchOptions.push({ "port_type": { $regex: key, $options: "is" } })
                    searchOptions.push({ "peripheral_type": { $regex: key, $options: "is" } })
                    searchOptions.push({ "memory_type": { $regex: key, $options: "is" } })
                    searchOptions.push({ "cable_end1": { $regex: key, $options: "is" } })
                    searchOptions.push({ "cable_end2": { $regex: key, $options: "is" } })
                    searchOptions.push({ "chipset": { $regex: key, $options: "is" } })
                    return resolve("done")
                })
            }))
            Part.aggregate([{ $match: { $or: searchOptions } }])
                .skip(parseInt(pageSize as string) * (parseInt(pageNum as string) - 1))
                .limit(parseInt(pageSize as string) + 1)
                .exec( async (err: CallbackError | null, parts: PartSchema[]) => {
                    if (err) {
                        // Database err
                        handleError(err)
                        return res.status(500).send("API could not handle your request: " + err);
                    }
                    Promise.all(parts.map((part)=>{
                        return new Promise(async (resolve, reject) => {
                            let count = await PartRecord.count({
                                nxid: part.nxid,
                                next: null,
                                location: location ? location : "Parts Room",
                                building: building ? building : req.user.building
                            });
                            let total_count = await PartRecord.count({
                                nxid: part.nxid,
                                next: null
                            });
                            let tempPart = JSON.parse(JSON.stringify(part))
                            tempPart.quantity = count;
                            tempPart.total_quantity = total_count;
                            return resolve(tempPart)
                        })
                    })).then((returnParts)=>{
                        return res.status(200).json(returnParts);
                    })
                })
        } catch (err) {
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    },
    // Update
    updatePartInfo: async (req: Request, res: Response) => {
        try {
            // Find part
            const { part } = req.body
            // Updated part is the old part from database
            let updatedPart = await Part.findByIdAndUpdate(part._id, part);
            if (updatedPart == null) {
                return res.status(400).send("Part not found.");
            }
            if (part.nxid != updatedPart.nxid) {
                // Update old NXID to new NXID
                PartRecord.find({ nxid: updatedPart.nxid },
                    (err: MongooseError, parts: PartSchema[]) => {
                        if (err) {
                            handleError(err)
                            return res.status(500).send("API could not handle your request: " + err);
                        }
                        // Change every part record
                        parts.map((part)=>{  
                            PartRecord.findByIdAndUpdate(part._id, {
                                nxid: updatedPart!.nxid
                            }, callbackHandler.callbackHandleError);
                        })
                    }
                )
            }
            return res.status(201).send(`Updated part: ${updatedPart.manufacturer} ${updatedPart.name}`);
        } catch (err) {
            // Database error
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    },
    addToInventory: async (req: Request, res: Response) => {
        try {
            // Get info from request
            let { part, owner } = req.body
            const { nxid, quantity, location, building } = part;
            // If any part info is missing, return invalid request
            if (!(nxid && quantity && location && building)||(quantity < 1))
                return res.status(400).send("Invalid request");
            let createOptions = {
                nxid,
                location: location,
                building: building,
                prev: null,
                next: null,
                by: req.user.user_id,
            } as PartRecordSchema
            // If asset, make sure asset exists
            switch(location) {
                case "Asset":
                    // Make sure asset exists
                    let asset = await Asset.findOne({ asset_tag: owner._id }) as AssetSchema
                    if(asset == null) 
                        return res.status(400).send("Asset Not Found");
                    // Add info to create options
                    createOptions.building = asset.building
                    createOptions.asset_tag = asset.asset_tag
                    break
                case "Tech Inventory":
                    // Check if id exists
                    if (owner._id) {
                        // Make sure tech exists
                        let tech = await User.findById(owner._id)
                        if (tech == null)
                            return res.status(400).send("User Not Found");
                        // Add create options 
                        createOptions.owner = tech._id
                        createOptions.building = tech.building
                    } 
                    else 
                        return res.status(400).send("Owner not present in request");
                    break
                case "All Techs":
                    createOptions.owner = 'all'
                    break
                default:
                    break
            }
            // Find part info
            Part.findOne({ nxid }, (err: MongooseError, part: PartSchema) => {
                if (err)
                    return res.status(500).send("API could not handle your request: " + err);
                for (let i = 0; i < quantity; i++) {
                    // Create new parts records to match the quantity
                    PartRecord.create(createOptions, callbackHandler.callbackHandleError);
                }
                // Success
                res.status(200).send("Successfully added to inventory")
            });
        } catch (err) {
            // Error
            handleError(err)
            res.status(500).send("API could not handle your request: " + err);
        }
    },
    deletePart: async (req: Request, res: Response) => {
        try {
            // Try to find and delete by ID
            if(req.query.nxid == undefined)
                return res.status(400).send("NXID missing from request");
            let { nxid } = req.query;
            // 
            let part = await Part.findOne({nxid})
            if(part==null)
                return res.status(400).send("Part not found");
            // Delete info
            await Part.findByIdAndDelete(part?._id);
            // Find all associated parts records
            PartRecord.find({
                nxid
            }, (err: MongooseError, parts: PartRecordSchema[]) => {
                if (err) {
                    // Error - don't return so other records will be deleted
                    handleError(err)
                    return res.status(500).send("API could not handle your request: " + err);
                }
                // Delete every part record
                parts.map(async (part) => {
                    await PartRecord.findByIdAndDelete(part._id)
                })
                res.status(200).json("Successfully deleted part and records");
            })
            // Success
        } catch (err) {
            // Error
            handleError(err)
            res.status(500).send("API could not handle your request: " + err);
        }
    },
    getDistinctOnPartRecords: async (req: Request, res: Response) => {
        try {
            // Get key to find distinct values
            const { key, where } = req.query;
            // Find all distinct part records
            PartRecord.find(where as PartRecordSchema).distinct(key as string, (err: MongooseError, record: PartRecordSchema[]) => {
                if (err)
                    res.status(500).send("API could not handle your request: " + err);
                else
                    res.status(200).json(record);
            })
        } catch (err) {
            // Error
            handleError(err)
            res.status(500).send("API could not handle your request: " + err);
        }
    },
    getDistinctOnPartInfo: async (req: Request, res: Response) => {
        try {
            // Get key to find distinct values
            const { key } = req.query;
            // Find all distinct part records
            Part.find().distinct(key as string, (err: MongooseError, record: PartSchema[]) => {
                if (err)
                    res.status(500).send("API could not handle your request: " + err);
                else
                    res.status(200).json(record);
            })
        } catch (err) {
            // Error
            handleError(err)
            res.status(500).send("API could not handle your request: " + err);
        }
    },
    getUserInventory: async (req: Request, res: Response) => {
        try {
            const { user_id } = req.query.user_id ? req.query : req.user
            if((user_id!=req.user.user_id)&&(req.user.role=="tech"))
                return res.status(403).send("You cannot view another user's inventory");
            PartRecord.find({ next: null, owner: user_id ? user_id : req.user.user_id }, async (err: MongooseError, records: PartRecordSchema[]) => {
                if (err) {
                    handleError(err)
                    return res.status(500).send("API could not handle your request: " + err);
                }
                let existingPartIDs = []
                let existingQuantities = []
                // Get NXID and quantities into separate arrays so indexOf() can be used
                for (const part of records) {
                    // Get index of part ID
                    let index = existingPartIDs.indexOf(part.nxid)
                    if (index == -1) {
                        // If part isn't in array, add it with a quantity of one
                        existingPartIDs.push(part.nxid)
                        existingQuantities.push(1)
                    } else {
                        // If part already exists, increment quantity
                        existingQuantities[index] += 1
                    }
                }
                let loadedCartItems = []
                // Get part info and push as LoadedCartItem interface from the front end
                for (let i = 0; i < existingPartIDs.length; i++) {
                    let part = await Part.findOne({ nxid: existingPartIDs[i] })
                    loadedCartItems.push({ part, quantity: existingQuantities[i] })
                }
                res.status(200).json(loadedCartItems)
            })
        } catch (err) {
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    },
    getPartRecordsByID: async (req: Request, res: Response) => {
        try {
            // Get nxid from query
            const { nxid } = req.query
            // Find all current parts records associated with nxid
            PartRecord.find({
                nxid,
                next: null
            }, (err: Mongoose, record: PartRecordSchema[]) => {
                if (err)
                    res.status(500).send("API could not handle your request: " + err);
                else
                    res.status(200).json(record);
            })
        } catch (err) {
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    },
    getPartHistoryByID: async (req: Request, res: Response) => {
        try {
            // Get mongo ID from query
            const { id } = req.query
            // Find first part record
            let record = await PartRecord.findById(id) as PartRecordSchema
            if(record == null) {
                return res.status(400).send("Record not found");
            }
            // Create array of part history
            let history = [record]
            // Loop until previous record is false
            while (record.prev != null) {
                record = await PartRecord.findById(record!.prev) as PartRecordSchema
                history.push(record)
            }
            // Send history to client
            res.status(200).json(history)
        } catch (err) {
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    },
    movePartRecords: async (req: Request, res: Response) => {
        try {
            // Get params from request
            let { from, to, quantity } = req.body
            from.next = null
            to.next = null
            to.by = req.user.user_id
            // Check NXIDs
            if(from.nxid != to.nxid) {
                return res.status(400).send("Mismatched nxids");
            }
            // Get records
            let fromRecords = await PartRecord.find(from)
            // Check quantities
            if (fromRecords.length >= quantity) {
                // Create and update records
                for (let i = 0; i < quantity; i++) {
                    to.prev = fromRecords[i]._id
                    PartRecord.create(to, callbackHandler.updateRecord)
                }
                // Return
                return res.status(200).send("Success");
            } else {
                // Invalid quantities
                return res.status(400).send("Invalid quantities");
            }

        } catch (err) {
            handleError(err)
            return res.status(500).send("API could not handle your request: " + err);
        }
    }
};

export default partManager;
