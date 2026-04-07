export function handleNotification(data: any, navigation: any) {
    if (data?.type) {
        switch (data.type) {
            case "INCIDENT":
                navigation.push(`/incident-details?id=${data.id}`)
                break;
            case "REQUEST":
                navigation.push(`/request-details?id=${data.id}`)
                break;
            case "COMPLAINT":
                navigation.push(`/complaint-details?id=${data.id}`)
                break;
            case "QUERY":
                navigation.push(`/query-details?id=${data.id}`)
                break;

            default:
                navigation.navigate("Home");
        }
    } else {
        navigation.navigate("my-incidents");
    }
}