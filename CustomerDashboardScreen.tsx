// Updated handleScheduleService function

handleScheduleService = (job) => {
    const payload = {};

    // Check job type and include the necessary fields
    if (job.type === 'BEAUTY') {
        payload.beautyServices = job.beautyServices;
    } else if (job.type === 'HAIR_DRESSER') {
        payload.subType = job.subType;
    }

    // Additional logic for scheduling service...

    return payload;
};