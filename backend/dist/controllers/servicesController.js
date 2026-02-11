// Placeholder controller - will be replaced during Use Case implementation
const mockServices = [
  {
    id: '1',
    name: 'Appeal Management',
    description: 'File and track appeals through the 5-stage workflow',
    url: '/appeals',
    icon: 'briefcase'
  },
  {
    id: '2',
    name: 'Public Decisions',
    description: 'Search and view published MSAT tribunal decisions',
    url: '/decisions',
    icon: 'document'
  },
  {
    id: '3',
    name: 'Hearing Schedule',
    description: 'View upcoming hearing dates and locations',
    url: '/hearings',
    icon: 'calendar'
  },
  {
    id: '4',
    name: 'Land Access Panel',
    description: 'Track LAP applications and orders for oil and gas access',
    url: '/lap',
    icon: 'map'
  }
];

export const getServices = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: mockServices,
      count: mockServices.length
    });
  } catch (error) {
    next(error);
  }
};

export const getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = mockServices.find(s => s.id === id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    next(error);
  }
};
